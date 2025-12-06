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
const views = {
    year: undefined,
    purpose: 'All',
    country: undefined,
}
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


```js
const yearSlider = () => { // {{{1
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
const slider = yearSlider(); // }}}
```

```js
const playButton = (slider) => { // {{{1
    let isPlaying = false;
    let intervalId = null;

    const button = html`<button style="
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        width: 100%;
        background: #333;
        color: white;
        border: none;
        border-radius: 6px;
    ">Play</button>`;

    const updateButton = () => {
        button.textContent = isPlaying ? "Pause" : "Play";
        button.style.background = isPlaying ? "#c33" : "#333";
    };

    const step = () => {
        let current = slider.value();
        if (current >= 2001) {
            // Loop back to start or stop — your choice
            current = 1945;
        } else {
            current += 1;
        }

        // Update the slider input element is inside the slider view
        const input = slider.querySelector('input');
        input.value = current;
        input.dispatchEvent(new Event('input')); // triggers your oninput and updates everything
    };

    const startAnimation = () => {
        console.log("start animation");
        if (isPlaying) return;
        isPlaying = true;
        updateButton();

        intervalId = setInterval(step, 2000);
    };

    const stopAnimation = () => {
        console.log("stop animation");
        if (!isPlaying) return;
        isPlaying = false;
        updateButton();
        clearInterval(intervalId);
        intervalId = null;
    };

    button.onclick = () => {
        if (isPlaying) {
            stopAnimation();
        } else {
            startAnimation();
        }
    };

    return button;
};
const playBtn = playButton(slider); // }}}
```

```js
const viewAllCheckbox = () => { // {{{1
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
// }}}
```

<div class="grid grid-cols-1">
    <div class="card">
        ${resize((width) => playBtn)}
        ${resize((width) => slider)}
        ${resize((width) => viewAllTime)}
    </div>
</div>

```js
function analyzeBombsByYearAndCountry(bombs) { // {{{1
    const totalByYear = {};
    const byCountryByYear = {}; // nested: year → country → count

    bombs.forEach(bomb => {
        const year = bomb.date;
        const country = bomb['origin country'];

        totalByYear[year] = (totalByYear[year] || 0) + 1;

        if (!byCountryByYear[year]) {
            byCountryByYear[year] = {};
        }
        byCountryByYear[year][country] = (byCountryByYear[year][country] || 0) + 1;
    });

    const result = Object.keys(totalByYear)
        .sort((a, b) => a - b)
        .map(year => ({
            year: parseInt(year),
            total: totalByYear[year],
            countries: byCountryByYear[year]
        }));

    return result;
}


const countedBombs = analyzeBombsByYearAndCountry(bombs);

console.log("Bomb data for bar chart");
console.log(countedBombs);
const aggregated = analyzeBombsByYearAndCountry(bombs);
// }}}
let barChart;
function bombsTimeline(aggregated, {width} = {}) { // {{{1
    const yearData = aggregated.map(entry => ({ year: entry.year }));

    barChart = Plot.plot({
        title: "Nuclear Detonations per Year",
        width: 1200,
        height: 300,
        x: { type: "band", tickFormat: "", tickRotate: -30, label: "" },
        y: { grid: true, label: "bombs" },
        marks: [
            Plot.barY(aggregated, {
                x: "year",
                y: "total",
                fill: "grey",
                tip: true,
            }),
            Plot.ruleY([0]),
            Plot.crosshairX(yearData, {
                x: "year",
                color: "red",
                opacity: .5,
                ruleStrokeWidth: 5,
            })
        ]
    });
}
bombsTimeline(aggregated);
let barYear;
const clicked = (event) => {
    barYear = barChart.value ? barChart.value.year : undefined;
    views.year = barYear;
    barYear ? updateMap(views.purpose, barYear) : updateMap(views.purpose, null);
};
barChart.addEventListener("click", clicked);
clicked(undefined);
// }}}
```

<div class="grid grid-cols-1">
    <div class="card">
        ${resize((width) => barChart)}
    </div>
</div>

```js
// {{{1 LEAFLET MAP
// 1. MAP INITIALIZATION {{{2
// console.log(barYear);
const container = display(document.createElement("div"));
container.style = "height: 600px;";
const map = L.map(container).setView([20, 20], 1.7);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd',
}).addTo(map);
// }}}

// 2. DATA LOADING AND PREPARATION {{{2

const colorScale = d3.scaleOrdinal(d3.schemeAccent);

const bombPurposeCotegories = ['All', ...new Set(bombs.map(b => b['purpose']))];
const bombOriginCategories = [...new Set(bombs.map(b => b['origin country']))];

bombPurposeCotegories.sort()

colorScale.domain(bombOriginCategories)
// }}}

// 3. MAP STYLING AND LAYERS {{{2

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
function updateMap(selectedType = 'All', selectedYear) {
    console.log("Update map with: " + selectedType + " " + selectedYear);

    const filteredCalls = bombs.filter(bomb => {

        if (selectedYear) {
            return (selectedType === 'All' || bomb['purpose'] === selectedType) && (parseInt(bomb['date']) === parseInt(selectedYear));
        } else {
            return (selectedType === 'All' || bomb['purpose'] === selectedType);
        }
    });

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

// {{{2 4. MAP CONTROLS (FILTERS AND TOOLTIP)
const filterControl = L.control({position: 'topright'});

filterControl.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
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
filterControl.addTo(map);
// }}}

// {{{2 5. EVENT LISTENERS

d3.select("#bomb-purpose-select").on("change", function() {
    const selectedType = this.value;
    const selectedYear = document.getElementById("year-slider")?.value || 1945;
    const viewAll = document.getElementById("view-all-checkbox")?.checked || false;
    views.purpose = selectedType;
    updateMap(views.purpose, views.year);
});
// }}}

// {{{2 6. HOVER TOOLTIP CONTROL
function onEachFeature(feature, layer) {
    if (feature.properties) {
        layer.bindTooltip(
            `
            <strong>${feature.properties.name === 'Nan' ? 'Unknown' :
            feature.properties.name}</strong><br> 
            Yield: ${feature.properties['lower yield']}–${feature.properties['upper yield']} kt<br>
            Lat/lon: ${feature.properties.latitude}/${feature.properties.longitude}<br>
            Placement: ${feature.properties.type}<br>
            Height Above Sea (km): ${-feature.properties['km depth']}<br>
            Year: ${feature.properties.date}<br>
            ${feature.properties.purpose} • ${feature.properties['origin country']}<br>
            `,
            {
                permanent: false,
                direction: 'top',
                offset: [0, -10],
                className: 'nuclear-tooltip'
            }
        );

        // Optional: open tooltip on hover
        layer.on('mouseover', (e) => {
            layer.openTooltip();
            highlightFeature(e);
        });
        layer.on('mouseout',  (e) => {
            layer.closeTooltip()
            resetHighlight(e);
        });
        layer.on('click',  (e) => {
            const country = feature.properties['origin country'];
            views.country = country;
        });
    }
}

// }}}

// {{{2 7. INTERACTIVITY FUNCTIONS (HOVER/CLICK)

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

// {{{2 8. INITIAL MAP LOAD
updateMap('All', null);
// }}}
// }}}
```

<div class="grid grid-cols-1">
    ${resize((width) => map())}
</div>

```js
function typeChart(data, {width}) { // {{{1
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
} // }}}
```

<div class="grid grid-cols-1">
    <div class="card">
        ${resize((width) => typeChart(bombs, {width}))}
    </div>
</div>

<style>
    .nuclear-tooltip {
        background: rgba(0,0,0,0.8);
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 13px;
    }
    .nuclear-tooltip::before {
        border-top-color: rgba(0,0,0,0.8) !important;
    }
</style>
