import React, { useState } from "react";
import "../../styles/AdminDashboard.css";

import CompanyLogo from "../../assets/trunorth/trunorth_icon.svg";
import SearchIcon from "../../assets/admin/admin_dashboard_table_search_icon.svg";
import SortIcon from "../../assets/admin/admin_dashboard_table_sort_icon.svg";

// MOCK USER DATA
const MOCK_USERS = [
  {
    name: "Olivia Bennett",
    userId: "104582",
    createdAt: "2023-05-14",
    lastLogin: "Oct 31, 02:00 PM",
  },
  {
    name: "Ethan Collins",
    userId: "104583",
    createdAt: "2023-11-02",
    lastLogin: "Oct 31, 02:00 PM",
  },
  {
    name: "Sophie Ramirez",
    userId: "104584",
    createdAt: "2024-03-21",
    lastLogin: "Oct 31, 02:00 PM",
  },
  {
    name: "Liam Turner",
    userId: "104585",
    createdAt: "2024-09-10",
    lastLogin: "Oct 31, 02:00 PM",
  },
];

const sortOptions = [
  "Date (Newest)",
  "Date (Oldest)",
  "Last Login (Newest)",
  "Last Login (Oldest)",
];

const AdminDashboard: React.FC = () => {
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState("Date (Newest)");

  const toggleSort = () => setSortOpen(!sortOpen);

  const handleSortSelect = (value: string) => {
    setSelectedSort(value);
    setSortOpen(false);
  };

  return (
    <div className="admin-dashboard">

      {/* HEADER */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <img src={CompanyLogo} alt="Company Logo" className="dash-header-logo" />
          <span className="dash-header-title">Review Dashboard</span>
        </div>
      </header>

      {/* SEARCH BAR */}
      <div className="admin-search-wrapper">
        <img src={SearchIcon} className="admin-search-icon" />
        <input
          type="text"
          className="admin-search-input"
          placeholder="Search By Username Or User ID"
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
            {selectedSort}
            <img src={SortIcon} className="admin-sort-icon" alt="sort icon" />
          </button>

          {sortOpen && (
            <div className="admin-sort-dropdown">
              {sortOptions.map((option) => (
                <div
                  key={option}
                  className="admin-sort-item"
                  onClick={() => handleSortSelect(option)}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="admin-table-scroll-area">
        <div className="admin-table-wrapper">

          {/* TABLE HEADER */}
          <div className="admin-table-header">
            <div className="col name">Name</div>
            <div className="col userid">User ID</div>
            <div className="col date">Creation Date</div>
            <div className="col login">Last Login</div>
          </div>

          {/* TABLE BODY */}
          <div className="admin-table-body">
            {MOCK_USERS.map((user, idx) => (
              <button key={idx} className="admin-table-row">
                <div className="admin-table-cell">{user.name}</div>
                <div className="admin-table-cell">{user.userId}</div>
                <div className="admin-table-cell">{user.createdAt}</div>
                <div className="admin-table-cell">{user.lastLogin}</div>
              </button>
            ))}
          </div>

        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
