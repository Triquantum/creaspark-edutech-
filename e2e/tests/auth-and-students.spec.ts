import { expect, test } from "@playwright/test";

test.describe("core flow: login → dashboard → students", () => {
  test("landing page renders and links to sign in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /future-ready education/i })).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin can log in and see the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@demo.educore.in");
    await page.getByLabel("Password").fill("Educore@123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Attendance today")).toBeVisible();
  });

  test("students table loads and search filters", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@demo.educore.in");
    await page.getByLabel("Password").fill("Educore@123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/students");
    await expect(page.getByRole("cell", { name: /ADM-/ }).first()).toBeVisible();

    await page.getByLabel("Search students").fill("Aarav");
    await expect(page.getByRole("cell", { name: /Aarav/ }).first()).toBeVisible();
  });

  test("wrong password shows an error, not a crash", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@demo.educore.in");
    await page.getByLabel("Password").fill("WrongPass1!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText(/invalid/i);
  });
});
