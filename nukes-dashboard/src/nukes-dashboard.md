---
theme: dashboard
title: Dashboard
toc: false
---

```js
import * as d3 from "npm:d3";
import * as L from "npm:leaflet";
```

# Nuclear Detonations

<!-- Load and transform the data -->

```js
const bombs = FileAttachment("data/nukes.csv").csv({typed: true});
```

<!-- A shared color scale for consistency, sorted by the number of nukes -->

```js
const color = Plot.scale({
    color: {
        type: "categorical",
        domain: d3.groupSort(bombs, (D) => -D.length, (d) => d["origin country"]),
        unknown: "var(--theme-foreground-muted)"
    }
});
```

<!-- Cards with big numbers -->

<div class="grid grid-cols-4">
    <div class="card">
        <h2>United States 🇺🇸</h2>
        <span class="big">${bombs.filter((d) => d["origin country"] === "USA").length.toLocaleString("en-US")}</span>
    </div>
    <div class="card">
        <h2>Russia 🇷🇺 <span class="muted">/ Soviet Union</span></h2>
        <span class="big">${bombs.filter((d) => d["origin country"] === "USSR").length.toLocaleString("en-US")}</span>
    </div>
    <div class="card">
        <h2>China 🇨🇳</h2>
        <span class="big">${bombs.filter((d) => d["origin country"] === "CHINA").length.toLocaleString("en-US")}</span>
    </div>
    <div class="card">
        <h2>Other</h2>
        <span class="big">${bombs.filter((d) => d["origin country"] === "CHINA").length.toLocaleString("en-US")}</span>
    </div>
</div>

```js
const yearSlider = () => {
    const slider = html`<input type="range" min="1945" max="2001" value="1" step="1" id="year-slider" style="width: 100%;">`;
    const label = html`<div>Year: <span id="year-value"></span></div>`;

    const updateLabel = () => {
        label.querySelector('#year-value').textContent = slider.value;
    };

    slider.oninput = () => {
        updateLabel();
        // Use Observable's built-in event system
        slider.dispatchEvent(new CustomEvent('input'));
    };

    updateLabel(); // Initialize label

    return Object.assign(html`<div>${label}${slider}</div>`, {
        value: () => +slider.value,
        addEventListener: (type, callback) => slider.addEventListener(type, callback)
    });
}
const slider = yearSlider();
```

```js
const viewAllCheckbox = () => {
  const checkbox = html`<input type="checkbox" id="view-all-checkbox">`;
  const label = html`<label for="view-all-checkbox">View All Years</label>`;
  
  checkbox.oninput = () => {
    // Use Observable's built-in event system
    checkbox.dispatchEvent(new CustomEvent('change'));
  };
  
  return Object.assign(html`<div>${checkbox}${label}</div>`, {
    checked: () => checkbox.checked,
    addEventListener: (type, callback) => checkbox.addEventListener(type, callback)
  });
}
const viewAllTime = viewAllCheckbox();
```

<div class="grid grid-cols-1">
    <div class="card">
        ${resize((width) => slider)}
        ${resize((width) => viewAllTime)}
    </div>
</div>

```js
// {{{1 INFO: 1. MAP INITIALIZATION
const container = display(document.createElement("div"));
container.style = "height: 600px;";
const map = L.map(container).setView([20, 20], 1.7);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; <a href=https://www.openstreetmap.org/copyright>OpenStreetMap</a> contributors"
}).addTo(map);
// }}}

// {{{1 INFO: 2. DATA LOADING AND PREPARATION

const colorScale = d3.scaleOrdinal(d3.schemeAccent);

const bombPurposeCotegories = ['All', ...new Set(bombs.map(b => b['purpose']))];
const bombOriginCategories = [...new Set(bombs.map(b => b['origin country']))];

bombPurposeCotegories.sort()

colorScale.domain(bombOriginCategories)
// }}}

// {{{1 INFO: 3. MAP STYLING AND LAYERS

/**
   * Defines the visual style for our data points (circle markers).
   * This function is called for every single point.
   * @param {object} feature - The GeoJSON feature (our call data).
   * @returns {object} A Leaflet Path options object.
   */
function style(feature) {
    return {
        radius: 6, // Size of the circle
        // Get the color for this feature's call type from our D3 scale
        fillColor: color.apply(feature.properties['origin country']),
        color: "#000", // Border color
        weight: 1, // Border width
        opacity: 1, // Border opacity
        fillOpacity: 0.75 // Fill opacity
    };
}

// Create a Leaflet Layer Group. This acts as a container for all our
// call data points. This is crucial because it allows us to
// clear all points at once (callsLayer.clearLayers()) instead of
// removing them one by one, which is much faster.
let bombsLayer = L.layerGroup().addTo(map);

/**
   * Main function to filter data and update the map.
   * This is called whenever a filter (dropdown, slider, checkbox) changes.
   * @param {string} selectedType - The call type from the dropdown.
   * @param {number} selectedMonth - The month from the slider.
   * @param {boolean} viewAll - The state of the 'View All' checkbox.
   */
function updateMap(selectedType = 'All', selectedYear = 1945, viewAll = false) {

    const filteredCalls = bombs.filter(bomb => 

        (selectedType === 'All' || bomb['purpose'] === selectedType) &&
        (viewAll || parseInt(bomb['date']) === parseInt(selectedYear))
    );

    // Convert our flat array of 'filteredCalls' into a GeoJSON FeatureCollection.
    // Leaflet's L.geoJSON layer understands this format.
    const geoJsonLike = {
        type: "FeatureCollection",
        features: filteredCalls.map(bomb => ({ // Create one "Feature" for each call
            type: "Feature",
            properties: bomb, // All CSV data goes here
            geometry: { // The geographic part
                type: "Point",
                // Coordinates must be [longitude, latitude] for GeoJSON
                coordinates: [parseFloat(bomb.longitude), parseFloat(bomb.latitude)]
            }
        }))
    };

    // Remove all previously drawn points from the layer group.
    bombsLayer.clearLayers();

    // Create a new L.geoJSON layer from our data.
    L.geoJSON(geoJsonLike, {
        /**
       * This function tells Leaflet HOW to draw each point.
       * Instead of default markers, we use L.circleMarker.
       */
        pointToLayer: function (feature, latlng) {
            // 'latlng' is the Leaflet-formatted coordinate.
            // We style the circle marker using our 'style' function.
            return L.circleMarker(latlng, style(feature));
        },
        /**
       * This function is called for each feature created.
       * It's where we attach our event listeners (hover, click).
       */
        onEachFeature: onEachFeature
    }).addTo(bombsLayer); // Add the new GeoJSON layer to our 'callsLayer' group.
}

// Add legend to map
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const labels = [];

    div.style.background = 'black';
    div.style.padding = '10px';
    div.style.border = '1px solid #ccc';

    labels.push('<strong>Country of Origin</strong>');
    for (let i = 0; i < bombOriginCategories.length; i++) {
        labels.push(
            `<i style="background:${color.apply(bombOriginCategories[i])}; width: 18px; height: 18px; float: left; margin-right: 8px; opacity: 0.8;"></i> ` +
            `${bombOriginCategories[i]}`
        );
    }
    div.innerHTML = labels.join('<br>');
    return div;
};

legend.addTo(map);
// }}}

// {{{1 INFO: 4. MAP CONTROLS (FILTERS AND TOOLTIP)

// Create the call type filter (dropdown menu)
const filterControl = L.control({position: 'topright'});

// 'onAdd' is called when the control is added to the map.
// It must create and return an HTML element.
filterControl.onAdd = function (map) {
    // Create a <div> with CSS classes 'info' and 'legend'.
    const div = L.DomUtil.create('div', 'info legend');
    // Populate the div with an HTML <select> dropdown.
    div.innerHTML = `
<select id="bomb-purpose-select">
    ${bombPurposeCotegories.map(type => `<option value="${type}">${type}</option>`).join('')}
</select>
`;
    // Note: We stop event propagation (e.g., map clicks) on this element
    // This is often done with L.DomEvent.disableClickPropagation(div),
    // but for a simple <select>, it often works without it.
    return div;
};
filterControl.addTo(map); // Add the control to the map.
// }}}

// {{{1 INFO: 5. EVENT LISTENERS

d3.select("#bomb-purpose-select").on("change", function() {
    const selectedType = this.value; // Get the new value from the dropdown
    // Get the current values from the other controls (assumed to be defined
    // in other Observable cells).
    const selectedYear = document.getElementById("year-slider")?.value || 1945;
    const viewAll = document.getElementById("view-all-checkbox")?.checked || false;
    // Re-draw the map with the new filter settings.
    updateMap(selectedType, selectedYear, viewAll);
});

slider.addEventListener('input', function() {
    const selectedYear = document.getElementById("year-slider")?.value || 1945;
    const viewAll = document.getElementById("view-all-checkbox")?.checked || false;
    const selectedType = d3.select("#bomb-purpose-select").property("value");
    updateMap(selectedType, selectedYear, viewAll);
});

// Listen for changes to the 'viewAllCheckbox' (defined in another cell).
viewAllTime.addEventListener('change', function() {
    const selectedYear = document.getElementById("year-slider")?.value || 1945;
    const viewAll = document.getElementById("view-all-checkbox")?.checked || false;
    const selectedType = d3.select("#bomb-purpose-select").property("value");
    updateMap(selectedType, selectedYear, viewAll);
});
// }}}

// {{{1 INFO: 6. HOVER TOOLTIP CONTROL

// Create the hover information box (tooltip)
const info = L.control(); // Default position is 'topleft'

// 'onAdd' creates the control's HTML element.
info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // Create a <div> with class 'info'
    this.update(); // Call update to set the default text
    return this._div;
};

/**
   * 'update' is a custom method we define for this control.
   * It updates the control's inner HTML based on feature properties.
   * @param {object} props - The 'properties' object from a GeoJSON feature.
   */
info.update = function (props) {
    // If 'props' exists, show feature info. Otherwise, show default message.
    this._div.innerHTML = '<h4>Detonation Information</h4>' + (props ?
        `
        <b>Name:</b> ${props['name']}<br />
        <b>Lat/lon:</b> ${props['latitude']}/${props['longitude']}<br />
        <b>Purpose:</b> ${props['purpose']}<br />
        <b>Upper Yield Estimate (kt TNT):</b> ${props['upper yield']}<br />
        <b>Lower Yield Estimate (kt TNT):</b> ${props['lower yield']}<br />
        <b>Type:</b> ${props['type']}<br />
        <b>Height Above Sea (km):</b> ${-parseFloat(props['km depth'])}<br />
        <b>Country of origin:</b> ${props['origin country']}<br />
        <b>Year:</b> ${props['date']}`
        : 'Hover over a point');
};
info.addTo(map); // Add the info control to the map.
// }}}

// {{{1 INFO: 7. INTERACTIVITY FUNCTIONS (HOVER/CLICK)

/**
   * Called on 'mouseover': highlights the point.
   * @param {Event} e - The Leaflet mouse event.
   */
function highlightFeature(e) {
    const layer = e.target; // 'e.target' is the layer (circle marker) hovered over.

    // Set a new, "highlighted" style for the layer.
    layer.setStyle({
        weight: 5, // Thicker border
        color: '#666', // Darker border color
        dashArray: '', // Solid border (if it was dashed)
        fillOpacity: 0.7 // Slightly more transparent
    });

    // Update the info box with this feature's properties.
    info.update(layer.feature.properties);
}

/**
   * Called on 'mouseout': resets the point's style.
   * @param {Event} e - The Leaflet mouse event.
   */
function resetHighlight(e) {
    const layer = e.target; // The layer being left.

    // Reset the layer's style back to its original state.
    // We call our 'style' function again to get the correct default style
    // based on its feature properties (e.g., to get the right color).
    layer.setStyle(style(layer.feature));

    // Reset the info box to its default "Hover over a point" message.
    info.update();
}

/**
   * Called on 'click': zooms the map to the point.
   * @param {Event} e - The Leaflet mouse event.
   */
function zoomToFeature(e) {
    // Note: circleMarker doesn't have 'getBounds()'. For a single point,
    // you might prefer map.setView(e.latlng, zoomLevel)
    // However, if it were a polygon, getBounds() would be correct.
    // For a circle, e.target.getBounds() *does* work, surprisingly.
    map.fitBounds(e.target.getBounds());
}

/**
   * This function is the "glue". It's called by L.geoJSON 'onEachFeature'.
   * It attaches all our event listeners to each layer (point).
   * @param {object} feature - The GeoJSON feature.
   * @param {L.Layer} layer - The Leaflet layer (our circle marker) for that feature.
   */
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}
// }}}

// {{{1 INFO: 8. INITIAL MAP LOAD
updateMap('All', 1945, false);
// }}}
```

<div class="grid grid-cols-1">
    <div class="card">
        ${resize((width) => map())}
    </div>
</div>


```js
function bombsTimeline(data, {width} = {}) {
    return Plot.plot({
        title: "nuclear bombs over the years",
        width,
        height: 300,
        y: {grid: true, label: "bombs"},
        color: {...color, legend: true},
        marks: [
            Plot.rectY(data, Plot.binX({y: "count"}, {x: "date", fill: "origin country", interval: 1, tip: true})),
            Plot.ruleY([0])
        ]
    });
}
```

<div class="grid grid-cols-1">
    <div class="card">
        ${resize((width) => bombsTimeline(bombs, {width}))}
    </div>
</div>

```js
function typeChart(data, {width}) {
  return Plot.plot({
    title: "Popular test types",
    width,
    height: 300,
    marginTop: 0,
    marginLeft: 50,
    x: {grid: true, label: "bombs"},
    y: {label: null},
    color: {...color, legend: true},
    marks: [
      Plot.rectX(data, Plot.groupY({x: "count"}, {y: "type", fill: "origin country", tip: true, sort: {y: "-x"}})),
      Plot.ruleX([0])
    ]
  });
}
```

<div class="grid grid-cols-1">
    <div class="card">
        ${resize((width) => typeChart(bombs, {width}))}
    </div>
</div>
