// The MIT License (MIT)

// Copyright (c) 2017 Zalando SE

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


function radar_visualization(config) {

  // custom random number generator, to make random sequence reproducible
  // source: https://stackoverflow.com/questions/521295
  var _seed = 42;
  function random() {
    var x = Math.sin(_seed++) * 10000;
    return x - Math.floor(x);
  }

  function random_between(min, max) {
    return min + random() * (max - min);
  }

  function normal_between(min, max) {
    return min + (random() + random()) * 0.5 * (max - min);
  }

  // radial_min / radial_max are multiples of PI
  const quadrants = [
    { radial_min: 0, radial_max: 0.5, factor_x: 1, factor_y: 1 },
    { radial_min: 0.5, radial_max: 1, factor_x: -1, factor_y: 1 },
    { radial_min: -1, radial_max: -0.5, factor_x: -1, factor_y: -1 },
    { radial_min: -0.5, radial_max: 0, factor_x: 1, factor_y: -1 }
  ];

  const rings = [
    { radius: 130 },
    { radius: 220 },
    { radius: 310 },
    { radius: 400 }
  ];

  const title_offset =
    { x: -675, y: -420 };

  const footer_offset =
    { x: -675, y: 420 };

  const legend_offset = [
    { x: 450, y: 90 },
    { x: -675, y: 90 },
    { x: -675, y: -310 },
    { x: 450, y: -310 }
  ];

  function polar(cartesian) {
    var x = cartesian.x;
    var y = cartesian.y;
    return {
      t: Math.atan2(y, x),
      r: Math.sqrt(x * x + y * y)
    }
  }

  function cartesian(polar) {
    return {
      x: polar.r * Math.cos(polar.t),
      y: polar.r * Math.sin(polar.t)
    }
  }

  function bounded_interval(value, min, max) {
    var low = Math.min(min, max);
    var high = Math.max(min, max);
    return Math.min(Math.max(value, low), high);
  }


  function bounded_ring(polar, r_min, r_max) {
    return {
      t: polar.t,
      r: bounded_interval(polar.r, r_min, r_max)
    }
  }

  function bounded_box(point, min, max) {
    return {
      x: bounded_interval(point.x, min.x, max.x),
      y: bounded_interval(point.y, min.y, max.y)
    }
  }

  function segment(quadrant, ring) {
    var polar_min = {
      t: quadrants[quadrant].radial_min * Math.PI,
      r: ring == 0 ? 30 : rings[ring - 1].radius
    };
    var polar_max = {
      t: quadrants[quadrant].radial_max * Math.PI,
      r: rings[ring].radius
    };
    var cartesian_min = {
      x: 15 * quadrants[quadrant].factor_x,
      y: 15 * quadrants[quadrant].factor_y
    };
    var cartesian_max = {
      x: rings[3].radius * quadrants[quadrant].factor_x,
      y: rings[3].radius * quadrants[quadrant].factor_y
    };
    return {
      clipx: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.x = cartesian(p).x; // adjust data too!
        return d.x;
      },
      clipy: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.y = cartesian(p).y; // adjust data too!
        return d.y;
      },
      random: function() {
        return cartesian({
          t: random_between(polar_min.t, polar_max.t),
          r: normal_between(polar_min.r, polar_max.r)
        });
      }
    }
  }

  // position each entry randomly in its segment
  function positionEntries(entries, config) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      entry.segment = segment(entry.quadrant, entry.ring);
      var point = entry.segment.random();
      entry.x = point.x;
      entry.y = point.y;
      entry.color = entry.active || config.print_layout ?
        config.rings[entry.ring].color : config.colors.inactive;
    }
  }

  function partitionSegments(segments) {
    for (var quadrant = 0; quadrant < 4; quadrant++) {
      segments[quadrant] = new Array(4);
      for (var ring = 0; ring < 4; ring++) {
        segments[quadrant][ring] = [];
      }
    }
    for (var i=0; i<config.entries.length; i++) {
      var entry = config.entries[i];
      segments[entry.quadrant][entry.ring].push(entry);
    }

  }

  // assign unique sequential id to each entry
  function assignIds(segments) {
    var id = 1;
    for (var quadrant of [2,3,1,0]) {
      for (var ring = 0; ring < 4; ring++) {
        var entries = segments[quadrant][ring];
        entries.sort(function(a,b) { return a.label.localeCompare(b.label); })
        for (var i=0; i<entries.length; i++) {
          entries[i].id = "" + id++;
        }
      }
    }
  }

  function translate(x, y) {
    return "translate(" + x + "," + y + ")";
  }

  function viewbox(quadrant) {
    return [
      Math.max(0, quadrants[quadrant].factor_x * 400) - 420,
      Math.max(0, quadrants[quadrant].factor_y * 400) - 420,
      440,
      440
    ].join(" ");
  }

  function drawGridLines(grid) {
    grid.append("line")
      .attr("x1", 0).attr("y1", -400)
      .attr("x2", 0).attr("y2", 400)
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
    grid.append("line")
      .attr("x1", -400).attr("y1", 0)
      .attr("x2", 400).attr("y2", 0)
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
  }

  // background color. Usage `.attr("filter", "url(#solid)")`
  // SOURCE: https://stackoverflow.com/a/31013492/2609980
  function drawFilter(grid) {
    var defs = grid.append("defs");
    var filter = defs.append("filter")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 1)
        .attr("height", 1)
        .attr("id", "solid");
    filter.append("feFlood")
      .attr("flood-color", "rgb(0, 0, 0, 0.8)");
    filter.append("feComposite")
      .attr("in", "SourceGraphic");
  }

  function drawRings(grid) {
    for (var i = 0; i < rings.length; i++) {
      grid.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", rings[i].radius)
        .style("fill", "none")
        .style("stroke", config.colors.grid)
        .style("stroke-width", 1);
      if (config.print_layout) {
        grid.append("text")
          .text(config.rings[i].name)
          .attr("y", -rings[i].radius + 62)
          .attr("text-anchor", "middle")
          .style("fill", "#e5e5e5")
          .style("font-family", "Arial, Helvetica")
          .style("font-size", 42)
          .style("font-weight", "bold")
          .style("pointer-events", "none")
          .style("user-select", "none");
      }
    }
  }

  function legend_transform(segments, quadrant, ring, index=null) {
    var dx = ring < 2 ? 0 : 120;
    var dy = (index == null ? -16 : index * 12);
    if (ring % 2 == 1) {
      dy = dy + 36 + segments[quadrant][ring-1].length * 12;
    }
    return translate(
      legend_offset[quadrant].x + dx,
      legend_offset[quadrant].y + dy
    );
  }

  function drawTitle(radar) {
    radar.append("text")
      .attr("transform", translate(title_offset.x, title_offset.y))
      .text(config.title)
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "34");
  }

  function drawFooter(radar) {
    radar.append("text")
      .attr("transform", translate(footer_offset.x, footer_offset.y))
      .text("▲ moved up     ▼ moved down")
      .attr("xml:space", "preserve")
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "10");
  }

  // SOURCE: https://stackoverflow.com/a/29202760

  function split(str, size) {
    const numSplits = Math.ceil(str.length / size);
    const splits = new Array(numSplits);

    for (let i = 0, o = 0; i < numSplits; ++i, o += size) {
      splits[i] = str.substr(o, size);
    }

    return splits;
  }

  function drawLegendWithDescription(segments, radar, d) {

    // Hacky de hack hack (to add the description under legend item)

    // Absolutely not proud of this but for now it works and it seems to be the fastest way.
    // Apologies to the person after me that needs to extend it. It might be better to move to:
    // https://github.com/thoughtworks/build-your-own-radar

    // Anyhow, here we add a description in the legend underneath the element that needs
    // a description. We look up what element is clicked, then look it up in the
    // segments, and add a new legend item underneath the one that contains the
    // description.

    // Done in this way because it is difficult to reposition elements
    // dynamically in SVG.

    var description = d.description;
    var clickedQuadrant = d.quadrant;
    var clickedRing = d.ring;
    var clickedId = d.id;

    // index of element in quadrant and ring
    var clickedIdx = segments[clickedQuadrant][clickedRing].indexOf(d);

    // Add the dummy description segment, we filter properties of regular legend
    // items (like showing a bubble on click) out later based on the
    // isDescription attribute
    // Add a dummy segment per line of the description
    const DESCRIPTION_LINE_LENGTH = 20;
    const splits = split(description, DESCRIPTION_LINE_LENGTH);
    for (splitIdx = splits.length; splitIdx >= 0; splitIdx--) {
      let desc = splits[splitIdx];
      let dummySegment = { isDescription: true, description: desc, descriptionForId: clickedId };
      segments[clickedQuadrant][clickedRing].splice(clickedIdx+1, 0, dummySegment);
    }

    drawLegend(segments, radar);
  }

  function drawLegend(segments, radar) {

    var legend = radar.append("g");
    for (var quadrant = 0; quadrant < 4; quadrant++) {
      legend.append("text")
        .attr("transform", translate(
          legend_offset[quadrant].x,
          legend_offset[quadrant].y - 45
        ))
        .text(config.quadrants[quadrant].name)
        .style("font-family", "Arial, Helvetica")
        .style("font-size", "18");
      for (var ring = 0; ring < 4; ring++) {
        legend.append("text")
          .attr("transform", legend_transform(segments, quadrant, ring))
          .text(config.rings[ring].name)
          .style("font-family", "Arial, Helvetica")
          .style("font-size", "12")
          .style("font-weight", "bold");
        legend.selectAll(".legend" + quadrant + ring)
          .data(segments[quadrant][ring])
          .enter()
            .append("text")
              .attr("transform", function(d, i) { return legend_transform(segments, quadrant, ring, i); })
              .attr("class", function(d, i) { if (d.isDescription) { return "description"; } else { return "legend" + quadrant + ring; } })
              .attr("id", function(d, i) { if (d.isDescription) { return "description" + i; } else { return "legendItem" + d.id; }})
              .text(function(d, i) { if (d.isDescription) { return d.description; } else { return d.id + ". " + d.label; } })
              .style("font-family", "Arial, Helvetica")
              .style("font-size", "11")
              .style("cursor", function(d) { if (!d.isDescription) return "pointer"; })
              .on("click", function(d) { if (!d.isDescription) { draw(d); }; })
              .on("mouseover", function(d) { if (!d.isDescription) { showBubble(d); highlightLegendItem(d); } })
              .on("mouseout", function(d) { if (!d.isDescription) { hideBubble(d); unhighlightLegendItem(d); } });
      }
    }
  }

  // layer for entries
  function drawEntries(radar) {
    var rink = radar.append("g")
        .attr("id", "rink");
    return rink;
  }

  function drawBubbles(radar) {
    var bubble = radar.append("g")
        .attr("id", "bubble")
        .attr("x", 0)
        .attr("y", 0)
        .style("opacity", 0)
        .style("pointer-events", "none")
        .style("user-select", "none");
    bubble.append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .style("fill", "#333");
    bubble.append("text")
      .style("font-family", "sans-serif")
      .style("font-size", "10px")
      .style("fill", "#fff");
    bubble.append("path")
      .attr("d", "M 0,0 10,0 5,8 z")
      .style("fill", "#333");
  }

  function showBubble(d) {
    if (d.active || config.print_layout) {
      var tooltip = d3.select("#bubble text")
        .text(d.label);
      var bbox = tooltip.node().getBBox();
      d3.select("#bubble")
        .attr("transform", translate(d.x - bbox.width / 2, d.y - 16))
        .style("opacity", 0.8);
      d3.select("#bubble rect")
        .attr("x", -5)
        .attr("y", -bbox.height)
        .attr("width", bbox.width + 10)
        .attr("height", bbox.height + 4);
      d3.select("#bubble path")
        .attr("transform", translate(bbox.width / 2 - 5, 3));
    }
  }

  function hideBubble(d) {
    var bubble = d3.select("#bubble")
      .attr("transform", translate(0,0))
      .style("opacity", 0);
  }

  function highlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    legendItem.setAttribute("filter", "url(#solid)");
    legendItem.setAttribute("fill", "white");
  }

  function unhighlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    legendItem.removeAttribute("filter");
    legendItem.removeAttribute("fill");
  }

  function drawBlips(segments, rink) {
    var blips = rink.selectAll(".blip")
        .data(config.entries)
        .enter()
        .append("g")
        .attr("class", "blip")
        .attr("transform", function(d, i) { return legend_transform(segments, d.quadrant, d.ring, i); })
        .on("click", function(d) { draw(d); })
        .on("mouseover", function(d) { showBubble(d); highlightLegendItem(d); })
        .on("mouseout", function(d) { hideBubble(d); unhighlightLegendItem(d); });
    return blips;
  }

  // configure each blip
  function configureBlips() {
    _blips.each(function(d) {
      var blip = d3.select(this);

      // blip link
      if (!config.print_layout && d.active && d.hasOwnProperty("link")) {
        blip = blip.append("a")
          .attr("xlink:href", d.link);
      }

      // blip shape
      if (d.moved > 0) {
        blip.append("path")
          .attr("d", "M -11,5 11,5 0,-13 z") // triangle pointing up
          .style("fill", d.color);
      } else if (d.moved < 0) {
        blip.append("path")
          .attr("d", "M -11,-5 11,-5 0,13 z") // triangle pointing down
          .style("fill", d.color);
      } else {
        blip.append("circle")
          .attr("r", 9)
          .attr("fill", d.color);
      }

      // blip text
      if (d.active || config.print_layout) {
        var blip_text = config.print_layout ? d.id : d.label.match(/[a-z]/i);
        blip.append("text")
          .text(blip_text)
          .attr("y", 3)
          .attr("text-anchor", "middle")
          .style("fill", "#fff")
          .style("font-family", "Arial, Helvetica")
          .style("font-size", function(d) { return blip_text.length > 2 ? "8" : "9"; })
          .style("pointer-events", "none")
          .style("user-select", "none");
      }
    });
  }

  // make sure that blips stay inside their segment
  function ticked() {
    _blips.attr("transform", function(d) {
      return translate(d.segment.clipx(d), d.segment.clipy(d));
    })
  }

  function distributeBlips(entries) {
    d3.forceSimulation()
      .nodes(entries)
      .velocityDecay(0.19) // magic number (found by experimentation)
      .force("collision", d3.forceCollide().radius(12).strength(0.85))
      .on("tick", ticked);
  }

  function clear(svg) {
    svg.selectAll("*").remove();
    svg.style("background-color", config.colors.background)
      .attr("width", config.width)
      .attr("height", config.height);
  }

  function resetSeed() {
    _seed = 42;
  }

  var _blips;

  // If no data d is passed draws svg without description underneath legend
  // item, otherwise with.
  function draw(d = null) {

    // partition entries according to segments
    var segments = new Array(4);
    var svg = d3.select("svg#" + config.svg_id);

    // Hacky de hack #2
    // Get current description elemnets before clearing SVG...

    var currentDescriptionElements = svg.selectAll(".description").data();
    clear(svg);

    // Otherwise blips do not end up in the same place
    resetSeed();

    var radar = svg.append("g");
    if ("zoomed_quadrant" in config) {
      svg.attr("viewBox", viewbox(config.zoomed_quadrant));
    } else {
      radar.attr("transform", translate(config.width / 2, config.height / 2));
    }

    var grid = radar.append("g");

    positionEntries(config.entries, config);
    partitionSegments(segments);
    assignIds(segments);
    drawGridLines(grid);
    drawFilter(grid);
    drawRings(grid);
    drawTitle(radar);
    drawFooter(radar);

    if (d) {
      // check if there already was a description, and for which id.
      // In the case a clicked item already had a description it needs to be removed
      if (currentDescriptionElements.length > 0 && currentDescriptionElements[0].descriptionForId === d.id) {
        drawLegend(segments, radar);
      } else {
        drawLegendWithDescription(segments, radar, d);
      }
    } else {
      drawLegend(segments, radar);
    }

    var rink = drawEntries(radar);
    _blips = drawBlips(segments, rink);
    configureBlips();
    drawBubbles(radar);

    // distribute blips, while avoiding collisions
    distributeBlips(config.entries);
  }

  if (config.print_layout) {
    draw();
  }

}
