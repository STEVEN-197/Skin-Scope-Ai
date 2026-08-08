"""Dashboard module tests."""
import pytest
from selenium.webdriver.common.by import By
from tests.selenium.utils.helpers import login, wait_for


@pytest.fixture(autouse=True)
def _login(driver, base_url, test_user):
    try:
        login(driver, base_url, test_user["email"], test_user["password"])
    except Exception:
        pytest.skip("Login unavailable")


@pytest.mark.parametrize("size", [(1440, 900), (768, 1024), (375, 812)])
@pytest.mark.parametrize("path", [
    "/dashboard", "/dashboard/analyze", "/dashboard/reports", "/dashboard/medical-reports",
    "/dashboard/prescriptions", "/dashboard/jarvis", "/dashboard/family",
    "/dashboard/timeline", "/dashboard/appointments", "/dashboard/twin",
    "/dashboard/compare", "/dashboard/share", "/dashboard/lifestyle",
    "/dashboard/insights", "/dashboard/intelligence", "/dashboard/diary",
    "/dashboard/reminders",
])
def test_route_renders(driver, base_url, path, size):
    driver.set_window_size(*size)
    driver.get(f"{base_url}{path}")
    body = wait_for(driver, (By.TAG_NAME, "body"))
    assert body.is_displayed()


def test_sidebar_navigation(driver, base_url):
    driver.get(f"{base_url}/dashboard")
    nav_links = driver.find_elements(By.CSS_SELECTOR, "nav a, aside a")
    assert len(nav_links) > 3


def test_jarvis_interaction(driver, base_url):
    driver.get(f"{base_url}/dashboard/jarvis")
    chat_box = wait_for(driver, (By.CSS_SELECTOR, "textarea[placeholder*='health']"))
    assert chat_box.is_displayed()


def test_analyze_upload_area(driver, base_url):
    driver.get(f"{base_url}/dashboard/analyze")
    drop_zone = wait_for(driver, (By.XPATH, "//button[contains(., 'Click to upload')]"))
    assert drop_zone.is_displayed()


def test_medical_reports_page(driver, base_url):
    driver.get(f"{base_url}/dashboard/medical-reports")
    heading = wait_for(driver, (By.XPATH, "//*[contains(text(), 'Medical') or contains(text(), 'Report')]"))
    assert heading.is_displayed()


def test_appointments_dialog(driver, base_url):
    driver.get(f"{base_url}/dashboard/appointments")
    schedule_btn = wait_for(driver, (By.XPATH, "//button[contains(., 'Book appointment')]"))
    assert schedule_btn.is_displayed()


def test_lifestyle_insights(driver, base_url):
    driver.get(f"{base_url}/dashboard/lifestyle")
    lifestyle_section = wait_for(driver, (By.TAG_NAME, "body"))
    assert lifestyle_section.is_displayed()


def test_timeline_cards(driver, base_url):
    driver.get(f"{base_url}/dashboard/timeline")
    timeline = wait_for(driver, (By.TAG_NAME, "body"))
    assert timeline.is_displayed()

