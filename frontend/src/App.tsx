import { useState } from "react";
import PropertyList from "./components/PropertyList";
import UserList from "./components/UserList";

function App() {
  const [activeTab, setActiveTab] = useState<"properties" | "users">("properties");

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold text-indigo-600">
                Invoice Automation
              </span>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                Admin Portal
              </span>
            </div>
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveTab("properties")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "properties"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Properties
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "users"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Users
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="py-6">
        {activeTab === "properties" && <PropertyList />}
        {activeTab === "users" && <UserList />}
      </main>
    </div>
  );
}

export default App;
