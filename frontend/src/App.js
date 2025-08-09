import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
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
  const [bunchedBuses, setBunchedBuses] = useState({});
  const [error, setError] = useState(null);

  // Function to calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  // Function to detect bus bunching
  const detectBunching = (busData) => {
    const BUNCHING_THRESHOLD = 0.5; // 500 meters in km
    const routeGroups = {};
    const bunched = {};

    // Group buses by route
    busData.forEach(bus => {
      if (!routeGroups[bus.routeId]) {
        routeGroups[bus.routeId] = [];
      }
      routeGroups[bus.routeId].push(bus);
    });

    // Check each route for bunching
    Object.entries(routeGroups).forEach(([routeId, routeBuses]) => {
      if (routeBuses.length < 2) return;

      for (let i = 0; i < routeBuses.length; i++) {
        for (let j = i + 1; j < routeBuses.length; j++) {
          const bus1 = routeBuses[i];
          const bus2 = routeBuses[j];
          
          const distance = calculateDistance(
            bus1.latitude, bus1.longitude,
            bus2.latitude, bus2.longitude
          );

          if (distance < BUNCHING_THRESHOLD) {
            if (!bunched[routeId]) {
              bunched[routeId] = [];
            }
            bunched[routeId].push({
              bus1Id: bus1.id,
              bus2Id: bus2.id,
              distance: distance,
              location: {
                lat: (bus1.latitude + bus2.latitude) / 2,
                lng: (bus1.longitude + bus2.longitude) / 2
              }
            });
          }
        }
      }
    });

    return bunched;
  };

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
              timestamp: entity.vehicle.timestamp,
            };
          }
          return null;
        }).filter(Boolean);

        setBuses(parsedBuses);
        
        // Detect bunching
        const bunchedResults = detectBunching(parsedBuses);
        setBunchedBuses(bunchedResults);

        // Alert for bunched buses
        Object.entries(bunchedResults).forEach(([routeId, instances]) => {
          console.warn(`Bus bunching detected on route ${routeId}:`, instances);
        });

      } catch (error) {
        console.error("Error fetching bus data:", error);
        setError(error.message);
      }
    };

    fetchBusData();
    const interval = setInterval(fetchBusData, 10000); // Fetch every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const sydneyPosition = [-33.8688, 151.2093];

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

  // Create a warning icon for bunched buses
  const createWarningIcon = (color) => {
    return L.divIcon({
      className: 'bunched-marker-icon',
      html: `
        <div style="
          background-color: ${color};
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 3px solid red;
          animation: pulse 1s infinite;
        "></div>
      `,
      iconSize: [16, 16],
    });
  };

  // Add CSS for the pulse animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      {error && <div style={{ color: 'red', padding: '10px' }}>Error: {error}</div>}
      
      {/* Bunching Alert Panel */}
      {Object.keys(bunchedBuses).length > 0 && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: 'red' }}>Bus Bunching Detected</h3>
          {Object.entries(bunchedBuses).map(([routeId, instances]) => (
            <div key={routeId} style={{ marginBottom: '10px' }}>
              <strong>Route {routeId}:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {instances.map((instance, idx) => (
                  <li key={idx}>
                    Buses {instance.bus1Id} and {instance.bus2Id}
                    <br />
                    Distance: {(instance.distance * 1000).toFixed(0)}m
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <MapContainer center={sydneyPosition} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        {buses.map(bus => {
          const color = getColorForRoute(bus.routeId);
          const isBunched = Object.entries(bunchedBuses).some(([routeId, instances]) =>
            instances.some(instance => 
              instance.bus1Id === bus.id || instance.bus2Id === bus.id
            )
          );
          const icon = isBunched ? createWarningIcon(color) : createMarkerIcon(color);
          
          return (
            <Marker 
              key={bus.id} 
              position={[bus.latitude, bus.longitude]} 
              icon={icon}
            >
              <Popup>
                <strong>Bus ID:</strong> {bus.id}<br />
                <strong>Route:</strong> {bus.routeId}<br />
                {isBunched && (
                  <span style={{ color: 'red' }}>
                    ⚠️ Bunched with another bus
                  </span>
                )}
              </Popup>
            </Marker>
          );
        })}

        {/* Draw circles around bunched buses */}
        {Object.entries(bunchedBuses).map(([routeId, instances]) =>
          instances.map((instance, idx) => (
            <Circle
              key={`${routeId}-${idx}`}
              center={[instance.location.lat, instance.location.lng]}
              radius={500} // 500 meters
              pathOptions={{
                color: 'red',
                fillColor: 'red',
                fillOpacity: 0.1
              }}
            />
          ))
        )}
      </MapContainer>
    </div>
  );
}

export default App;