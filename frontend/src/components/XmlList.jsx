import React from 'react';

function XmlList({ xmlData, onEdit, onDelete, onSelect }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg transform transition-all hover:shadow-2xl">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">XML Data List</h3>
      {xmlData.length === 0 ? (
        <p className="text-gray-600">No XML data available.</p>
      ) : (
        <ul className="space-y-2">
          {xmlData.map((item) => (
            <li
              key={item.id}
              className="flex justify-between items-center p-3 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <span className="text-gray-800">{item.name}</span>
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                  className="px-3 py-1 bg-yellow-500 text-white rounded-md text-sm font-medium hover:bg-yellow-600 transition-colors duration-300"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="px-3 py-1 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors duration-300"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default XmlList;