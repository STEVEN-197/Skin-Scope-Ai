"""Selenium helper utilities."""
import time
from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def wait_for(driver, locator, timeout=10):
    time.sleep(0.35)
    return WebDriverWait(driver, timeout, ignored_exceptions=(StaleElementReferenceException,)).until(
        EC.visibility_of_element_located(locator)
    )


def wait_clickable(driver, locator, timeout=10):
    time.sleep(0.35)
    return WebDriverWait(driver, timeout, ignored_exceptions=(StaleElementReferenceException,)).until(
        EC.element_to_be_clickable(locator)
    )


def login(driver, base_url, email, password):
    """Sign in through the real login form (Supabase auth)."""
    driver.get(f"{base_url}/login")
    wait_for(driver, (By.ID, "email"), timeout=15).send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    WebDriverWait(driver, 20).until(lambda d: "/dashboard" in d.current_url)
