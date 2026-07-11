// Tiny shared state so index.js can publish the resolved monitored-channel
// list for the /api/sources route to read.

let monitoredSources = [];

function setMonitoredSources(sources) {
  monitoredSources = sources;
}

function getMonitoredSources() {
  return monitoredSources;
}

module.exports = { setMonitoredSources, getMonitoredSources };
