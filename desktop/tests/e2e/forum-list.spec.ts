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
