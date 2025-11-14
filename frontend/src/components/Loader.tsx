import React from "react";
import "../styles/Loader.css";

const Loader: React.FC<{ text?: string }> = ({ text = "Loading recommendations..." }) => {
  return (
    <div className="loader-container">
      <div className="loader-spinner"></div>
      <p className="loader-text">{text}</p>
    </div>
  );
};

export default Loader;
