import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "../../styles/AdminDashboard.css";

import CompanyLogo from "../../assets/trunorth/trunorth_icon.svg";
import SearchIcon from "../../assets/admin/admin_dashboard_table_search_icon.svg";
import SortIcon from "../../assets/admin/admin_dashboard_table_sort_icon.svg";
import LogoutIcon from "../../assets/admin/admin_logout_icon.svg";

import { adminAuthService, adminAuthToken } from "../../services/admin_auth_service";
import { adminUserService } from "../../services/adminUserService";

const sortOptions = [
  { label: "Date (Newest)", value: "created_at_desc" },
  { label: "Date (Oldest)", value: "created_at_asc" },
  { label: "Last Login (Newest)", value: "last_login_desc" },
  { label: "Last Login (Oldest)", value: "last_login_asc" }
];

// ⭐ EST DATE FORMATTER
const formatEST = (isoString: string | null) => {
  if (!isoString) return "--";

  try {
    const date = new Date(isoString);

    return date.toLocaleString("en-US", {
      timeZone: "America/New_York",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }) + " EST";
  } catch (err) {
    return isoString;
  }
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [sortOpen, setSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState(sortOptions[0]);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------
  // 🔐 AUTH GUARD
  // ---------------------------------------------------------
  useEffect(() => {
    if (!adminAuthToken.get()) {
      navigate("/admin/login");
    }
  }, [navigate]);

  // ---------------------------------------------------------
  // 📥 FETCH USERS
  // ---------------------------------------------------------
  const loadUsers = async () => {
    try {
      setLoading(true);

      const res = await adminUserService.getUsers({
        search,
        sort_by: selectedSort.value
      });

      setUsers(res);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search, selectedSort]);

  // ---------------------------------------------------------
  // 🚪 HANDLE LOGOUT
  // ---------------------------------------------------------
  const handleLogout = () => {
    adminAuthService.logout();
    navigate("/admin/login");
  };

  const toggleSort = () => setSortOpen(!sortOpen);

  const handleSortSelect = (opt: any) => {
    setSelectedSort(opt);
    setSortOpen(false);
  };

  return (
    <div className="admin-dashboard">

      {/* HEADER */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <img
            src={CompanyLogo}
            alt="Company Logo"
            className="dash-header-logo"
            onClick={() => navigate("/admin/dashboard")}
            style={{ cursor: "pointer" }}
          />
          <span className="dash-header-title">Admin Dashboard</span>

          <button className="logout-btn" onClick={handleLogout}>
            Log out
            <img src={LogoutIcon} className="logout-icon" alt="logout" />
          </button>
        </div>
      </header>

      {/* SEARCH BAR */}
      <div className="admin-search-wrapper">
        <img src={SearchIcon} className="admin-search-icon" />

        <input
          type="text"
          className="admin-search-input"
          placeholder="Search By Username Or User ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* LINE */}
      <div className="admin-divider-line"></div>

      {/* TITLE + SORT */}
      <div className="admin-table-title-row">
        <h2 className="admin-table-title">User Review Dashboard</h2>

        <div className="admin-sort-container">
          <span className="admin-sort-label">Sort By</span>

          <button className="admin-sort-button" onClick={toggleSort}>
            {selectedSort.label}
            <img src={SortIcon} className="admin-sort-icon" alt="sort icon" />
          </button>

          {sortOpen && (
            <div className="admin-sort-dropdown">
              {sortOptions.map((option) => (
                <div
                  key={option.value}
                  className="admin-sort-item"
                  onClick={() => handleSortSelect(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="admin-table-scroll-area">
        <div className="admin-table-wrapper">

          {/* HEADER */}
          <div className="admin-table-header">
            <div className="col name">Name</div>
            <div className="col userid">User ID</div>
            <div className="col date">Creation Date</div>
            <div className="col login">Last Login</div>
          </div>

          {/* BODY */}
          <div className="admin-table-body">
            {loading ? (
              <div className="loading-msg">Loading users...</div>
            ) : (
              users.map((user: any) => (
                <button
                  key={user.id}
                  className="admin-table-row"
                  onClick={() => navigate(`/admin/user-review/${user.id}`)}
                >
                  <div className="admin-table-cell">{user.firstname} {user.lastname}</div>
                  <div className="admin-table-cell">{user.id}</div>

                  {/* ⭐ Apply EST Formatter */}
                  <div className="admin-table-cell">{formatEST(user.created_at)}</div>
                  <div className="admin-table-cell">{formatEST(user.last_login)}</div>
                </button>
              ))
            )}
          </div>

        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
