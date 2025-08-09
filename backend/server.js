require('dotenv').config();
const express = require('express');
const axios = require('axios');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings').transit_realtime;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/buses', async (req, res) => {
    const apiKey = process.env.TFN_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Transport for NSW API key not configured.' });
    }

    try {
        const response = await axios.get('https://api.transport.nsw.gov.au/v1/gtfs/vehiclepos/buses', {
            headers: {
                'Authorization': `apikey ${apiKey}`
            },
            responseType: 'arraybuffer'
        });

        const feed = GtfsRealtimeBindings.FeedMessage.decode(new Uint8Array(response.data));
        res.json(feed);
    } catch (error) {
        console.error('Error fetching bus data:', error.message);
        res.status(500).json({ error: 'Failed to fetch bus data from Transport for NSW API.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
