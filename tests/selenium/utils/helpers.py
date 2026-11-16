"""Selenium helper utilities."""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def wait_for(driver, locator, timeout=10):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located(locator))


def wait_clickable(driver, locator, timeout=10):
    return WebDriverWait(driver, timeout).until(EC.element_to_be_clickable(locator))


def login(driver, base_url, email, password):
    """Sign in through the real login form (Supabase auth).

    The old localStorage 'mock-user-logged-in' bypass was removed from the app
    (security finding FINDING-002), so tests must authenticate for real.
    Raises TimeoutException if the account cannot reach /dashboard.
    """
    driver.get(f"{base_url}/login")
    wait_for(driver, (By.ID, "email"), timeout=15).send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    WebDriverWait(driver, 20).until(lambda d: "/dashboard" in d.current_url)
