from datetime import date

from app.services.allocations import Period, peak_load

D = date.fromisoformat


def test_empty() -> None:
    assert peak_load([], Period(D("2026-01-01"), None, 0)) == (0, None)


def test_overlapping_periods_add_up() -> None:
    periods = [
        Period(D("2026-01-01"), None, 50),
        Period(D("2026-02-01"), D("2026-02-28"), 30),
    ]
    assert peak_load(periods, Period(D("2026-01-01"), None, 0)) == (80, D("2026-02-01"))


def test_adjacent_periods_do_not_overlap() -> None:
    periods = [
        Period(D("2026-01-01"), D("2026-01-31"), 100),
        Period(D("2026-02-01"), None, 100),
    ]
    assert peak_load(periods, Period(D("2026-01-01"), None, 0))[0] == 100


def test_window_clips_periods() -> None:
    periods = [
        Period(D("2026-01-01"), D("2026-01-31"), 100),
        Period(D("2026-03-01"), None, 40),
    ]
    assert peak_load(periods, Period(D("2026-02-01"), None, 0)) == (40, D("2026-03-01"))
    assert peak_load(periods, Period(D("2026-02-01"), D("2026-02-20"), 0)) == (0, None)
