import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon issue with Webpack
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function App() {
  const [buses, setBuses] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBusData = async () => {
      try {
        const response = await fetch('/api/buses');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const parsedBuses = data.entity.map(entity => {
          if (entity.vehicle && entity.vehicle.position) {
            return {
              id: entity.id,
              latitude: entity.vehicle.position.latitude,
              longitude: entity.vehicle.position.longitude,
              routeId: entity.vehicle.trip.routeId,
            };
          }
          return null;
        }).filter(Boolean);

        setBuses(parsedBuses);
      } catch (error) {
        console.error("Error fetching bus data:", error);
        setError(error.message);
      }
    };

    fetchBusData();
    const interval = setInterval(fetchBusData, 10000); // Fetch every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const sydneyPosition = [-33.8688, 151.2093]; // Sydney coordinates

  const getColorForRoute = (routeId) => {
    // Simple hash function to generate a color from the route ID
    let hash = 0;
    for (let i = 0; i < routeId.length; i++) {
      hash = routeId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsl(${hash % 360}, 100%, 50%)`;
    return color;
  };

  const createMarkerIcon = (color) => {
    return L.divIcon({
      className: 'custom-marker-icon',
      html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [12, 12],
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      {error && <div style={{ color: 'red', padding: '10px' }}>Error: {error}</div>}
      <MapContainer center={sydneyPosition} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        {buses.map(bus => {
          const color = getColorForRoute(bus.routeId);
          const icon = createMarkerIcon(color);
          return (
            <Marker key={bus.id} position={[bus.latitude, bus.longitude]} icon={icon}>
              <Popup>
                Bus ID: {bus.id}<br />
                Route: {bus.routeId}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default App;