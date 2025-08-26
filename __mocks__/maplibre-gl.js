// Mock for maplibre-gl to avoid WebGL issues in tests
class Map {
  constructor() {
    this.sources = {}
    this.layers = []
  }
  
  on(event, callback) {
    // Mock event listener
  }
  
  off(event, callback) {
    // Mock event listener removal
  }
  
  addSource(id, source) {
    this.sources[id] = source
  }
  
  removeSource(id) {
    delete this.sources[id]
  }
  
  getSource(id) {
    return this.sources[id]
  }
  
  addLayer(layer) {
    this.layers.push(layer)
  }
  
  removeLayer(id) {
    this.layers = this.layers.filter(l => l.id !== id)
  }
  
  flyTo(options) {
    // Mock fly to animation
  }
  
  remove() {
    // Mock cleanup
  }
}

module.exports = {
  Map,
  Marker: class Marker {
    constructor() {}
    setLngLat() { return this }
    addTo() { return this }
    remove() { return this }
  },
  Popup: class Popup {
    constructor() {}
    setLngLat() { return this }
    setHTML() { return this }
    addTo() { return this }
    remove() { return this }
  },
  NavigationControl: class NavigationControl {},
  ScaleControl: class ScaleControl {},
}