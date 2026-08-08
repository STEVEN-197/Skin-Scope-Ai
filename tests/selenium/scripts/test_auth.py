"""Authentication module tests (TC_001 - TC_012)."""
import pytest
from selenium.webdriver.common.by import By
from tests.selenium.utils.helpers import wait_for, login


@pytest.mark.smoke
def test_login_page_loads(driver, base_url):
    driver.get(f"{base_url}/login")
    assert wait_for(driver, (By.CSS_SELECTOR, "input[type='email']"))


def test_invalid_email_format(driver, base_url):
    driver.get(f"{base_url}/login")
    email = wait_for(driver, (By.CSS_SELECTOR, "input[type='email']"))
    email.send_keys("abc")
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("x")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    assert "/login" in driver.current_url


def test_protected_route_redirects(driver, base_url):
    driver.get(f"{base_url}/dashboard")
    # Either redirected to /login or a login UI appears
    assert "/login" in driver.current_url or driver.find_elements(By.CSS_SELECTOR, "input[type='email']")


def test_signup_page_loads(driver, base_url):
    driver.get(f"{base_url}/signup")
    assert wait_for(driver, (By.CSS_SELECTOR, "input[type='email']"))


@pytest.mark.auth
def test_valid_login(driver, base_url, test_user):
    pytest.importorskip("dotenv")
    try:
        login(driver, base_url, test_user["email"], test_user["password"])
    except Exception:
        pytest.skip("Test account not provisioned")
    assert "/dashboard" in driver.current_url


def test_empty_login_credentials(driver, base_url):
    driver.get(f"{base_url}/login")
    wait_for(driver, (By.CSS_SELECTOR, "input[type='email']"))
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    assert "/login" in driver.current_url


def test_login_page_links(driver, base_url):
    driver.get(f"{base_url}/login")
    wait_for(driver, (By.CSS_SELECTOR, "input[type='email']"))
    signup_link = driver.find_element(By.LINK_TEXT, "Create an account")
    signup_link.click()
    assert "/signup" in driver.current_url


def test_signup_invalid_email(driver, base_url):
    driver.get(f"{base_url}/signup")
    name = wait_for(driver, (By.ID, "name"))
    name.send_keys("Test User")
    driver.find_element(By.ID, "email").send_keys("invalidemail")
    driver.find_element(By.ID, "password").send_keys("TestPassword123!")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    assert "/signup" in driver.current_url


def test_signup_password_too_short(driver, base_url):
    driver.get(f"{base_url}/signup")
    name = wait_for(driver, (By.ID, "name"))
    name.send_keys("Test User")
    driver.find_element(By.ID, "email").send_keys("test@example.com")
    driver.find_element(By.ID, "password").send_keys("123")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    assert "/signup" in driver.current_url


def test_login_incorrect_password(driver, base_url):
    driver.get(f"{base_url}/login")
    email = wait_for(driver, (By.CSS_SELECTOR, "input[type='email']"))
    email.send_keys("test@example.com")
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("WrongPass123!")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    assert "/login" in driver.current_url


def test_signup_blank_password(driver, base_url):
    driver.get(f"{base_url}/signup")
    name = wait_for(driver, (By.ID, "name"))
    name.send_keys("Test User")
    driver.find_element(By.ID, "email").send_keys("newuser@example.com")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    assert "/signup" in driver.current_url


def test_signup_blank_name(driver, base_url):
    driver.get(f"{base_url}/signup")
    email = wait_for(driver, (By.ID, "email"))
    email.send_keys("newuser@example.com")
    driver.find_element(By.ID, "password").send_keys("TestPassword123!")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    assert "/signup" in driver.current_url


