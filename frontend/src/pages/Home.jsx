import React from 'react';

const Home = () => {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 p-4 text-center">
      <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-3">
        TruNorth is Live!
      </h1>
      <p className="text-base md:text-lg text-gray-600 max-w-sm">
        Welcome to the mobile-first frontend setup ✅
      </p>
      <button className="mt-6 bg-gray-900 text-white py-2 px-5 rounded-lg shadow-md hover:bg-gray-800 transition">
        Get Started
      </button>
    </div>
  );
};

export default Home;
