
// Check Layer Table Attributes
import { getLayerAttributes, WORKSPACE } from './services/Server';

async function checkLayerSchema() {
    console.log("Checking schema for " + WORKSPACE + ":Layer");
    const attrs = await getLayerAttributes(`${WORKSPACE}:Layer`, true);
    console.log("Attributes:", JSON.stringify(attrs, null, 2));
}

checkLayerSchema();
