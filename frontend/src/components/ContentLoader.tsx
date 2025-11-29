import React from "react";
import "../styles/ContentLoader.css";

interface Props {
  text?: string;
}

const ContentLoader: React.FC<Props> = ({ text = "Loading…" }) => {
  return (
    <div className="content-loader-wrapper">
      <div className="content-loader-ring">
        <div></div><div></div><div></div><div></div>
      </div>
      <p className="content-loader-text">{text}</p>
    </div>
  );
};

export default ContentLoader;
