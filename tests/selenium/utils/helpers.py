"""Selenium helper utilities."""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def wait_for(driver, locator, timeout=10):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located(locator))


def wait_clickable(driver, locator, timeout=10):
    return WebDriverWait(driver, timeout).until(EC.element_to_be_clickable(locator))


def login(driver, base_url, email, password):
    driver.get(f"{base_url}/login")
    driver.execute_script("localStorage.setItem('mock-user-logged-in', 'true')")
    driver.get(f"{base_url}/dashboard")
    WebDriverWait(driver, 15).until(lambda d: "/dashboard" in d.current_url)
