import React from "react";

export default function MapControls({ layers, activeLayers, onToggleLayer }) {
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white/90 p-2 rounded shadow-md border border-gray-200">
      <h4 className="text-xs font-bold uppercase mb-2 text-gray-600">Couches</h4>
      <div className="space-y-1">
        {layers.map((layer) => (
          <label key={layer.id} className="flex items-center space-x-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={activeLayers.includes(layer.id)}
              onChange={() => onToggleLayer(layer.id)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>{layer.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
