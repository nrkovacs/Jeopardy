from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    page.goto('http://localhost:8000')

    # Wait for the board to load
    page.wait_for_selector('.clue')

    # Click the first clue
    page.locator('.clue').first.click()

    # Wait for the modal to appear
    page.wait_for_selector('#clueModal')

    # Take a screenshot of the modal
    page.locator('#clueModal').screenshot(path='jules-scratch/verification/verification.png')

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
