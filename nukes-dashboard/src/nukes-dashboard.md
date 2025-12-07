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

```js
const bombs = FileAttachment("data/nukes.csv").csv({typed: true});
const views = {
    year: undefined,
    purpose: 'All',
    country: undefined,
}
```

```js
const color = Plot.scale({
    color: {
        type: "categorical",
        domain: d3.groupSort(bombs, (D) => -D.length, (d) => d["origin country"]),
    }
});
```

```js
function analyzeBombsByYearAndCountry(bombs) { // {{{1
    const totalByYear = {};
    const byCountryByYear = {};

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
const aggregated = analyzeBombsByYearAndCountry(bombs);
// }}}

function bombsTimeline(country, {width} = {}) { // {{{1
    let data;
    let fill;
    let title;

    if (!country || country === 'All') {
        data = aggregated;
        fill = "grey";
        title = "Nuclear Detonations per Year";
    } else {
        data = aggregated.map(entry => ({
            year: entry.year,
            total: entry.countries[country] || 0
        }));
        fill = color.apply(country);
        title = `Nuclear Detonations per Year for ${country}`;
    }

    const yearData = aggregated.map(entry => ({ year: entry.year }));

    return Plot.plot({
        title,
        width: width,
        height: 300,
        x: { type: "band", tickFormat: "", tickRotate: -30, label: "" },
        y: { grid: true, label: "bombs" },
        marks: [
            Plot.barY(data, {
                x: "year",
                y: "total",
                fill,
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
bombsTimeline(views.country);

let barYear;
const clicked = (event) => {
    if (event) {
        const chart = event.currentTarget;
        barYear = chart.value ? chart.value.year : undefined;
        views.year = barYear;
        barYear ? updateMap(views.purpose, barYear) : updateMap(views.purpose, null);
    }
};
clicked(undefined);
// }}}
```

<div class="grid grid-cols-1">
    <div class="card">
        ${resize((width) => { const createChart = () => { const c = bombsTimeline(views.country, {width}); c.addEventListener("click", clicked); return c; }; let currentChart = createChart(); const reload = () => { const newChart = createChart(); currentChart.replaceWith(newChart); currentChart = newChart; }; window.addEventListener("update-chart", reload); return currentChart; })}
    </div>
</div>

```js
// {{{1 LEAFLET MAP
// 1. MAP INITIALIZATION {{{2
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

function style(feature) {
    return {
        radius: 6,
        fillColor: color.apply(feature.properties['origin country']),
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.75
    };
}

// This it allows us to clear all points at once (callsLayer.clearLayers())
// instead of removing them one by one, which is much faster.
let bombsLayer = L.layerGroup().addTo(map);

/**
   * Main function to filter data and update the map.
   * This is called whenever a filter changes.
   * @param {string} selectedType - The call type from the dropdown.
   * @param {number} selectedYear - The year clicked in the bar chart.
   */
function updateMap(selectedType = 'All', selectedYear) {
    console.log("Update map with: " + selectedType + " " + selectedYear);

    const filteredCalls = bombs.filter(bomb => {
        // some of the russian bombs have no lat/lon and default to 0/0
        if (parseFloat(bomb['latitude']) === 0 &&
            parseFloat(bomb['longitude']) === 0) return false;

        if (selectedYear) {
            return (selectedType === 'All' || bomb['purpose'] === selectedType) && (parseInt(bomb['date']) === parseInt(selectedYear));
        } else {
            return (selectedType === 'All' || bomb['purpose'] === selectedType);
        }
    });

    // Leaflet's L.geoJSON layer understands this format.
    const geoJsonLike = {
        type: "FeatureCollection",
        features: filteredCalls.map(bomb => ({
            type: "Feature",
            properties: bomb,
            geometry: {
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
            return L.circleMarker(latlng, style(feature));
        },
        onEachFeature: onEachFeature
    }).addTo(bombsLayer);
}

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

// {{{2 5. EVENT LISTENERS & TOOLTIP

d3.select("#bomb-purpose-select").on("change", function() {
    const selectedType = this.value;
    const selectedYear = document.getElementById("year-slider")?.value || 1945;
    const viewAll = document.getElementById("view-all-checkbox")?.checked || false;
    views.purpose = selectedType;
    updateMap(views.purpose, views.year);
});

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
            window.dispatchEvent(new CustomEvent("update-chart"));
        });
    }
}

// }}}

// {{{2 6. INTERACTIVITY FUNCTIONS (HOVER/CLICK)

/**
    * Controls the highlighting on mouseover.
    * @param {Event} e - The Leaflet mouse event.
*/
function highlightFeature(e) {
    const layer = e.target;

    layer.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.7
    });
}

/**
   * Called on 'mouseout': resets the point's style.
   * @param {Event} e - The Leaflet mouse event.
   */
function resetHighlight(e) {
    const layer = e.target;
    layer.setStyle(style(layer.feature));
}
// }}}

// {{{2 7. INITIAL MAP LOAD
updateMap('All', null);
// }}}
//}}}
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
