import { test, expect } from "@playwright/test";
import { thinkingModels } from "../../src/thinkingData";

test("all 12 lessons load their own knowledge illustration", async ({
  page,
}) => {
  for (const model of thinkingModels) {
    await page.goto(`/#/thinking?model=${model.id}`);
    await page.getByRole("button", { name: "知识图", exact: true }).click();
    const picture = page.locator(".knowledge-preview img");
    await expect(picture).toBeVisible();
    await expect
      .poll(() =>
        picture.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(picture).toHaveAttribute(
      "src",
      `/thinking-illustrations/${model.id}-${model.id === "batna" ? "v2" : "v1"}.png`,
    );
  }
});

for (const width of [390, 1280]) {
  test(`knowledge image supports enlargement, zoom, download and escape at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/thinking?model=pyramid");
    await page.getByRole("button", { name: "知识图", exact: true }).click();
    await page.getByRole("button", { name: "放大金字塔原理知识图" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole("button", { name: "关闭知识图" }),
    ).toBeFocused();
    await page.getByRole("slider", { name: "知识图缩放" }).fill("200");
    await expect(page.locator(".knowledge-canvas img")).toHaveAttribute(
      "style",
      "width: 200%;",
    );
    await page.getByRole("button", { name: "适合宽度" }).click();
    await expect(page.getByRole("slider", { name: "知识图缩放" })).toHaveValue(
      "100",
    );
    const downloading = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载原图" }).click();
    const file = await downloading;
    expect(file.suggestedFilename()).toBe("金字塔原理-知识图.png");
    expect(await file.failure()).toBeNull();
    await page.screenshot({
      path: `.reference-analysis/knowledge-reader-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "放大金字塔原理知识图" }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
