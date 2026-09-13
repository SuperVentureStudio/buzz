import { expect, test } from "@playwright/test";

import { installMockBridge, TEST_IDENTITIES } from "../helpers/bridge";

async function waitForMockLiveSubscription(
  page: import("@playwright/test").Page,
  channelName: string,
) {
  await expect
    .poll(() =>
      page.evaluate(
        (name) =>
          window.__BUZZ_E2E_HAS_MOCK_LIVE_SUBSCRIPTION__?.({
            channelName: name,
          }) ?? false,
        channelName,
      ),
    )
    .toBe(true);
}

async function emitForumPosts(
  page: import("@playwright/test").Page,
  contents: string[],
) {
  return page.evaluate(
    ({ bodies, pubkey }) =>
      bodies.map(
        (content) =>
          window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
            channelName: "watercooler",
            content,
            kind: 45001,
            pubkey,
          })?.id,
      ),
    { bodies: contents, pubkey: TEST_IDENTITIES.alice.pubkey },
  );
}

test("a forum past one page loads older posts on demand", async ({ page }) => {
  await installMockBridge(page);
  await page.goto("/");

  await page.getByTestId("channel-general").click();
  await waitForMockLiveSubscription(page, "watercooler");
  // Two mock posts already exist, so 49 more crosses the 50-post page size.
  await emitForumPosts(
    page,
    Array.from({ length: 49 }, (_, index) => `Paged post ${index + 1}`),
  );

  await page.getByTestId("channel-watercooler").click();
  await expect(page.getByTestId("chat-title")).toHaveText("watercooler");

  const loadOlder = page.getByRole("button", { name: "Load older posts" });
  await expect(loadOlder).toBeVisible();

  await loadOlder.click();
  await expect(loadOlder).toHaveCount(0);
  await expect(
    page.getByText("Release checklist: async feedback thread."),
  ).toBeVisible();
});

test("search and status chips narrow the forum to the threads you want", async ({
  page,
}) => {
  await installMockBridge(page);
  await page.goto("/");

  await page.getByTestId("channel-general").click();
  await waitForMockLiveSubscription(page, "watercooler");
  const [, fixedPostId] = await emitForumPosts(page, [
    "Bugsnag · WebMedic\n\nSQLSTATE[40001]: Deadlock found when trying to get lock",
    "Bugsnag · D-Link website\n\nCall to a member function get_queried_object() on null",
  ]);
  await page.evaluate(
    ({ rootId, pubkey }) =>
      window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
        channelName: "watercooler",
        content: "Fixed in the last deploy.",
        extraTags: [["status", "fixed"]],
        kind: 45003,
        parentEventId: rootId,
        pubkey,
      }),
    { rootId: fixedPostId, pubkey: TEST_IDENTITIES.alice.pubkey },
  );

  await page.getByTestId("channel-watercooler").click();
  const rows = page.getByTestId("forum-post-row");
  // Two seeded posts plus the two above.
  await expect(rows).toHaveCount(4);

  const search = page.getByRole("textbox", { name: "Search posts" });
  await search.fill("deadlock");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Bugsnag · WebMedic");

  // Escape clears the search without reaching for the mouse.
  await search.press("Escape");
  await expect(rows).toHaveCount(4);

  await page.getByRole("button", { name: /^Fixed/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Bugsnag · D-Link website");

  // A search that matches nothing under the chosen status offers a way back.
  await search.fill("deadlock");
  await expect(page.getByText("No posts match")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(4);
});

test("threads sort by latest activity, and the sort menu reorders them", async ({
  page,
}) => {
  await installMockBridge(page);
  await page.goto("/");

  // A new comment on the older, quieter seeded thread should lift it to the top.
  await page.getByTestId("channel-general").click();
  await waitForMockLiveSubscription(page, "watercooler");
  await page.evaluate(
    (pubkey) =>
      window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
        channelName: "watercooler",
        content: "Flights are booked.",
        kind: 45003,
        parentEventId: "mock-forum-offsite-thread",
        pubkey,
      }),
    TEST_IDENTITIES.alice.pubkey,
  );

  await page.getByTestId("channel-watercooler").click();
  const rows = page.getByTestId("forum-post-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Team offsite planning");

  const sort = page.getByTestId("forum-sort");
  await expect(sort).toHaveAccessibleName("Sort: Latest activity");
  await sort.click();
  await page.getByRole("menuitemradio", { name: "Most replies" }).click();

  await expect(sort).toHaveAccessibleName("Sort: Most replies");
  await expect(rows.first()).toContainText("Release checklist");
});
