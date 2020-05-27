if (!nabu) { var nabu = {} }
if (!nabu.page) { nabu.page = {} }
if (!nabu.page.views) { nabu.page.views = {} }
if (!nabu.page.views.data) { nabu.page.views.data = {} }

// features to add:
// - a limit line, for example suppose the y values are between 0 and 100 and you want a reference to be drawn at 60, you could set a limit line there
// 		- perhaps also allow an average limit line
// - can do a "stacked" line chart (best seen in full area opacity)
// 		- for each line, sum the values of all the previous lines as well (e.g. to show total profit)
// - legend next to axis instead of on top: https://bl.ocks.org/wdickerson/bd654e61f536dcef3736f41e0ad87786
window.addEventListener("load", function () {
	nabu.page.views.data.Line = Vue.component("data-line", {
		template: "#data-line",
		mixins: [nabu.page.views.data.DataCommon],
		created: function() {
			this.create();
			this.normalizeCustom(this.cell.state);
		},
		activate: function(done) {
			var self = this;
			this.activate(function() {
				done();
				self.draw();
			});
		},
		data: function() {
			return {
				configuring: false,
				// the current zoom level
				zoom: 1,
				zoomXOffset: 0,
				zoomYOffset: 0,
				svg: null,
				hidden: []
			}
		},
		beforeDestroy: function() {
			this.$services.page.destroy(this);
		},
		computed: {
			fromColor: function() {
				return this.cell.state.fromColor ? this.cell.state.fromColor : "darkred";
			},
			toColor: function() {
				return this.cell.state.toColor ? this.cell.state.toColor : "darkolivegreen";
			},
			arcWidth: function() {
				return this.cell.state.arcWidth ? this.cell.state.arcWidth / 100 : 0.1;
			}
		},
		methods: {
			configure: function() {
				this.configuring = true;	
			},
			// http://projects.delimited.io/experiments/multi-series/multi-line-full.html
			draw: function() {
				var self = this;
				if (this.cell.state.y && this.$refs.svg) {
					nabu.utils.elements.clear(this.$refs.svg);
					var records = this.records.filter(function(record) {
						return typeof(record[self.cell.state.y]) != "undefined";
					});
					var margin = {top: this.cell.state.legendPosition == "top" ? 30 : 20, right: 55, bottom: this.cell.state.legendPosition == "bottom" ? 40 : 30, left: 50};
						
					this.svg = d3.select(this.$refs.svg),
						width = this.$el.offsetWidth - margin.right - margin.left,
						// reserve some space for title etc
						height = this.$el.offsetHeight - (self.cell.state.title ? 80 : 30);
						
					if (this.cell.state.legendPosition == "bottom") {
						height -= 50;
					}
					
					if (this.cell.state.filterType != null && this.cell.state.filterType.component == "data-combo-filter") {
						height -= 70;
					}
						
					var svg = this.svg;
					
					// subtract for actions
					if (self.globalActions.length) {
						height -= 75;
					}
					
					var result = this.$services.dataUtils.extractValues(self.cell, records);
					var xValues = result.xValues;
					var yValues = result.yValues;
					var zValues = result.zValues;
					var minY = result.minY;
					var maxY = result.maxY;
					
					if (minY > 0 && !!this.cell.state.zeroYAxis) {
						minY = 0;
					}
					
					if (this.cell.state.maxYValue) {
						var parsed = parseInt(this.cell.state.maxYValue);
						if (parsed > maxY) {
							maxY = parsed;
						}
					}
					
					var pageInstance = this.$services.page.getPageInstance(this.page, this);
					
					pageInstance.$emit("svg:predraw", {
						source: this,
						z: zValues,
						x: xValues,
						y: yValues
					});
					
					// copy from bar.js to determine height based on angle of labels
					if (this.cell.state.rotateX) {
						var longest = 0;
						xValues.map(function(value) {
							value = self.cell.state.xFormat ? self.$services.formatter.format(value, self.cell.state.xFormat) : value;
							if (("" + value).length > longest) {
								longest = ("" + value).length;
							}
						});
						// we assume a fixed size per letter (e.g. 12)
						// we take a percentage based on the angle
						height -= longest * 14 * (Math.min(50, this.cell.state.rotateX) / 100);
					}
					svg.attr('width', width + margin.left + margin.right)
						.attr('height', height + margin.top + margin.bottom);
					console.log("definition is", this.definition);
					var isDate = this.cell.state.x && this.definition[this.cell.state.x].format && this.definition[this.cell.state.x].format.indexOf("date") == 0;
					
					if (!isDate) {
						// band = spread the values evenly over the available space so the gap between 0 and 10 is as big as the one between 10 and 10000
						var x = d3.scaleBand()
							.rangeRound([0, width])
							.padding(0.1)
							.domain(xValues)
							.align(0);
					}
					else {
						var x = d3.scaleTime()
							.rangeRound([0, width])
							.domain(d3.extent(xValues, function(d) { return d; }));
					}
					
					// linear = spread the values as per their actual value, so the gap between 0 and 10 would be much smaller than the one between 10 and 10000	
					var y = d3.scaleLinear()
						.rangeRound([height, 0])
						.domain([minY, maxY])
						.nice();

					this.drawGrid(svg, width, height, margin, x, y);
					
					var g = svg.append("g")
						.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
						
					var xInterval = self.cell.state.xInterval;
					// instead of an interval, we can define a max amount of ticks
					if (xInterval == null && self.cell.state.xTicks) {
						xInterval = Math.floor(xValues.length / self.cell.state.xTicks);
					}
					
					if (!isDate) {
						var axisBottom = d3.axisBottom(x).tickFormat(function(d, index) {
							if (xInterval && index % xInterval != 0) {
								// if it is the last one, we want to make sure there is enough space with the previous one
								if (index < xValues.length - 1 || index % xInterval < 3) {
									return "";
								}
							}
							else if (self.cell.state.xIntegerOnly) {
								// only works on numbers
								if (typeof(d) == "number") {
									// if the value is an integer itself, show it
									if (d != d.toFixed(1)) {
										if (index > 0 && Math.floor(xValues[index - 1]) >= Math.floor(d)) {
											return "";
										}
									}
								}
							}
							return self.$services.formatter.format(d, self.cell.state.xFormat);	
						});
					}
					else {
						var axisBottom = d3.axisBottom(x).tickFormat(function(d, index) {
							if (!xInterval || (index % xInterval == 0)) {
								return self.$services.formatter.format(d, self.cell.state.xFormat);	
							}
						});
					}
					
					// the following if is incorrect
					if (this.cell.state.xTicks && false) {
						axisBottom.ticks(this.cell.state.xTicks);
					}
					
					var xAxis = g.append("g")
						.attr("class", "axis x-axis")
						.attr("transform", "translate(0," + height + ")")
						.call(axisBottom);
						
					// if you want to rotate the labels on the x axis, make it so scotty
					if (this.cell.state.rotateX) {
						xAxis
							.selectAll("text")
							.style("text-anchor", "end")
							.attr("transform", "rotate(-" + this.cell.state.rotateX + ")");
					}
					
					var axisLeft = d3.axisLeft(y).tickFormat(function(d) {
						var result = self.$services.formatter.format(d, self.cell.state.yFormat);
						if (typeof(result) == "number" && result >= 100000000) {
							result = Math.round(result / 1000000) + "M";
						}
						if (typeof(result) == "number" && result >= 1000000) {
							result = Math.round(result / 1000) + "k";
						}
						return result;
					});
					
					var yAxis = g.append("g")
						.attr("class", "axis y-axis")
						.call(axisLeft)
						.append("text")
						.attr("class", "y-axis-label")
						.attr("fill", "#333")
						// rotate and shift a bit
						.attr("transform", "rotate(-90)")
						.attr("y", 6)
						.attr("dy", "0.71em");
						
					if (this.cell.state.yLabel) {
						yAxis.text(this.cell.state.yLabel);
					}
					
					var line = d3.line();
					
					if (self.cell.state.interpolation) {
						var algo = this.getInterpolation().filter(function(x) { return x.name == self.cell.state.interpolation })[0];
						if (algo) {
							line.curve(algo.algo);
						}
					}
					
					// the addition is probably to center the value in the middle of the bandwidth
					line.x(function (d) { return x(d.label) }) //  + x.bandwidth() / 2;
						.y(function (d) { return y(d.value); });
						
					var color = d3.scaleLinear()
						.domain([0, Math.max(1, zValues.length - 1)])
						.range([this.fromColor, this.toColor])
						.interpolate(d3.interpolateHcl);
						
					// https://github.com/d3/d3-scale-chromatic
					if (this.cell.state.colorScheme) {
						color = function(i) { return d3[self.cell.state.colorScheme][i] };
					}
					
					var seriesData;
					if (zValues.length) {
						seriesData = zValues.map(function (name) {
							return {
								name: name,
								values: records.filter(function(record) {
									return record[self.cell.state.z] == name;
								}).map(function (d, i) {
									return { name: name, label: self.cell.state.x ? d[self.cell.state.x] : i, value: d[self.cell.state.y], data: d };
								})
							};
						});
					}
					else {
						seriesData = [{
							name: "series",
							values: records.map(function(record, i) {
								return {
									name: "series",
									label: self.cell.state.x ? record[self.cell.state.x] : i,
									value: record[self.cell.state.y],
									data: record
								}
							})
						}];
					}
					
					var htmlBuilder = function (data, i) {
						//self.$services.dataUtils.buildStandardD3Tooltip(data.data, i, self.buildToolTip);	
						self.$services.dataUtils.buildStandardD3Tooltip(data.data, i, self.buildSimpleToolTip(self.cell.state.y));
					};
					
					var series = svg.selectAll(".series")
						.data(seriesData)
						.enter().append("g")
						.attr("class", "series")
						.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
					
					var strokeWidth = this.cell.state.strokeWidth;
					if (!strokeWidth) {
						strokeWidth = 3;
					}
					var colorPicker = function (d) { return color(zValues.length ? zValues.indexOf(d.name) : 0); }
					series.append("path")
						.attr("class", function(d, index) { return "line line-" + index})
						.attr("d", function (d) { return line(d.values); })
						.style("stroke", colorPicker)
						.style("stroke-width", strokeWidth + "px")
						.style("fill", "none");
					
					if (self.cell.state.areaOpacity) {
						var area = d3.area()
							.x(function(d) { return x(d.label)  })
							.y0(height)
							.y1(function(d) { return y(d.value); });
						series.append("path")
					       .attr("class", "area")
					       .attr("d", function (d) { return area(d.values); })
					       .style("fill", colorPicker)
					       .style("opacity", parseInt(self.cell.state.areaOpacity) / 10);
					}
					
					if (self.cell.state.pointRadius) {
						series.selectAll(".point")
							.data(function (d) { return d.values; })
							.enter().append("circle")
							.attr("class", "point")
							.attr("cx", function (d) { return x(d.label); })
							.attr("cy", function (d) { return y(d.value); })
							.attr("r", self.cell.state.pointRadius + "px")
							//.style("fill", function (d) { return color(zValues.length ? zValues.indexOf(d.name) : 0); })
							//.style("stroke", "grey")
							//.style("stroke-width", "1px")
							.style("fill", "#fff")
							.style("stroke", function (d) { return color(zValues.length ? zValues.indexOf(d.name) : 0); })
							.style("stroke-width", "1px")
							//.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
							.on("mouseover", htmlBuilder)
							.on("mouseout",  self.$services.dataUtils.removeStandardD3Tooltip)
					}
					
					if (this.cell.state.legend && zValues.length) {
						var zFormatter = function(d, i) {
							var result = self.cell.state.zFormat ? self.$services.formatter.format(d, self.cell.state.zFormat, self.page, self.cell) : d;
							// ugly hack to update the result value later on
							// the injected value in d3 is not reactive...
							if (!result) {
								setTimeout(function() {
									var result = self.cell.state.zFormat ? self.$services.formatter.format(d, self.cell.state.zFormat, self.page, self.cell) : d;		
									if (result) {
										var text = svg.selectAll(".legend-" + i);
										text.text(result);
										var totalWidth = 0;
										svg.selectAll(".legend-entry")
											.attr("transform", function(d, i, el) {
												var result = "translate(" + totalWidth + ", 0)";
												totalWidth += el.item(i).getBBox().width + 15;
												return result;
											});
									}
								}, 300);
							}
							return result;
						}
						if (!this.cell.state.legendPosition || this.cell.state.legendPosition == "right") {
							var legend = svg.append("g")
								.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
								.attr("font-family", "sans-serif")
								.attr("font-size", 10)
								.attr("text-anchor", "end")
								.selectAll("g")
								.data(zValues.slice().reverse())
								.enter()
									.append("g")
									.attr("class", "legend-entry")
									.attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });
									
							legend.append("rect")
								.attr("x", width - 19)
								.attr("width", 19)
								.attr("height", 19)
								.attr("fill", function(d) { return color(zValues.indexOf(d)) });
							
							legend.append("text")
								.attr("x", width - 24)
								.attr("y", 9.5)
								.attr("dy", "0.32em")
								.text(zFormatter);
						}
						else {
							var legend = svg.append("g")
								.attr("transform", "translate(" + margin.left + ", " + (this.cell.state.legendPosition == "top" ? "0" : height + margin.top + 30) + ")")
								.attr("font-family", "sans-serif")
								.attr("font-size", 10)
								.attr("text-anchor", "start")
								.selectAll("g")
								.data(zValues.slice())
								.enter()
									.append("g")
									.attr("class", "legend-entry");

							legend.append("rect")
								.attr("width", 19)
								.attr("height", 19)
								.attr("fill", function(d) { return color(zValues.indexOf(d)) });
							
							legend.append("text")
								.attr("dx", 25)
								.attr("y", 9.5)
								.attr("dy", "0.32em")
								.attr("class", function(d, i) { return "legend-" + i })
								.text(zFormatter);
								
							var totalWidth = 0;
							svg.selectAll(".legend-entry")
								.attr("transform", function(d, i, el) {
									var result = "translate(" + totalWidth + ", 0)";
									totalWidth += el.item(i).getBBox().width + 15;
									return result;
								});
						}
						
						svg.selectAll(".legend-entry")
							.on("click", function(d, i, el) {
								if (el.item(i).classList.contains("hidden")) {
									svg.select(".line-" + i)
										.style("visibility", "visible")
									svg.select(".mouse-per-line-" + i)
										.style("visibility", "visible")
									el.item(i).classList.remove("hidden");
								}
								else {
									svg.select(".line-" + i)
										.style("visibility", "hidden");
									svg.select(".mouse-per-line-" + i)
										.style("visibility", "hidden")
									el.item(i).classList.add("hidden");
								}
							});
					}
					
					var toggle = function(zValue) {
						var zIndex = zValues.indexOf(zValue);
						if (zIndex >= 0) {
							var index = self.hidden.indexOf(zValue);
							if (index >= 0) {
								svg.select(".line-" + zIndex)
									.style("visibility", "visible")
								svg.select(".mouse-per-line-" + zIndex)
									.style("visibility", "visible")
								self.hidden.splice(index, 1);
							}
							else {
								svg.select(".line-" + zIndex)
									.style("visibility", "hidden");
								svg.select(".mouse-per-line-" + zIndex)
									.style("visibility", "hidden")
								self.hidden.push(zValue);
							}
						}
					}
					
					// reinforce the hidden on redraw
					this.hidden.map(function(x) {
						var zIndex = zValues.indexOf(x);
						svg.select(".line-" + zIndex)
							.style("visibility", "hidden");
						svg.select(".mouse-per-line-" + zIndex)
							.style("visibility", "hidden")
					});
					
					if (this.cell.state.drawMouseLine) {
						this.drawLineAtMouse(
							svg,
							width,
							height,
							margin,
							x,
							y,
							seriesData,
							color,
							zValues
						);
					}
					
					// zoom
					if (this.cell.state.zoomX || this.cell.state.zoomY) {
						var extent = [[margin.left, margin.top], [width - margin.right, height - margin.top]];
						
						var zoomed = function() {
							// only works on linear scales, not scaleBand (it uses invert)
							// xAxis.call(axisBottom.scale(d3.event.transform.rescaleX(x)));
							// we don't want to zoom in the y-axis, also doesn't seem to work...?
			  				//yAxis.call(axisLeft.scale(d3.event.transform.rescaleY(y)));
			  				
			  				
							var t = d3.event.transform;
							self.zoom = t.k;
							self.zoomXOffset = t.x;
							self.zoomYOffset = t.y;
							
							if (self.cell.state.zoomX) {
								x.range([0, width + margin.left].map(function(d) {
									return t.applyX(d);
								}));
								svg.selectAll(".x-axis").call(axisBottom);
							}
							if (self.cell.state.zoomY) {
								y.range([height, 0].map(function(d) {
									return t.applyY(d);
								}));
								svg.selectAll(".y-axis").call(axisLeft);
							}
							
							// for bar charts
							//svg.selectAll(".bars rect").attr("x", d => x(d.name)).attr("width", x.bandwidth());
							
							// the transform x & y are correct for translating into the position that your mouse is
							// the scale we call always (?) returns an x & y of 0 so if you use that x & y, you always zoom at (0,0) independent of the mouse
							
							var scale = d3.zoomIdentity.scale(t.k);
							// we can't go smaller than the original
							if (scale.k < 1) {
								scale.k = 1;
							}
							// by default the scale toString() method does this: translate(scale.x, scale.y) scale(scale.k)
							// as per the documentation, a scale() with one parameter scales evenly in all directions
							// we want directional scaling, so we stringify it ourselves
							var scaleX = self.cell.state.zoomX ? scale.k : 1;
							var scaleY = self.cell.state.zoomY ? scale.k : 1;
							
							var translateX = self.cell.state.zoomX ? t.x : 0;
							var translateY = self.cell.state.zoomY ? t.y : 0;
							
							svg.selectAll(".line")
								.attr("transform", "translate(" + translateX + "," + translateY + ") scale(" + scaleX + "," + scaleY + ")");
							svg.selectAll(".area")
								.attr("transform", "translate(" + translateX + "," + translateY + ") scale(" + scaleX + "," + scaleY + ")");
								
							svg.selectAll(".grid-y")
								.attr("transform", "translate(" + margin.left + "," + (translateY + margin.top) + ") scale(" + scaleX + "," + scaleY + ")");
								
							// we added a small correction to the x translation
							// it is not perfect but for some reason the x axis starts off with a smaller tick for 0 (space between origin and 0 and smaller than 0 and next value) and at first this is in sync with the grid x axis
							// once you starts zooming however, this discrepency is "fixed" in the original x axis but because we zoom the grid lines differently, they are not adjusted correctly
							// this is an approximation and not entirely accurate...
							svg.selectAll(".grid-x")
								.attr("transform", "translate(" + (margin.left + (3 * scale.k)) + "," + (height + margin.top) + ") scale(" + scaleX + "," + scaleY + ")");
								
						}
						svg.call(d3.zoom()
							.scaleExtent([1, 8])
							.translateExtent(extent)
							.extent(extent)
							.on("zoom", zoomed));
					}
					
					pageInstance.$emit("svg:drawn", {
						source: this,
						color: color, 
						z: zValues,
						x: xValues,
						y: yValues,
						toggle: toggle,
						hidden: this.hidden
					});
				}
			},
			getInterpolation: function() {
				return [
					{name:"linear", algo: d3.curveLinear},
					{name:"curveStep", algo: d3.curveStep},
					{name:"curveStepBefore", algo: d3.curveStepBefore},
					{name:"curveStepAfter", algo: d3.curveStepAfter},
					{name:"curveBasis", algo: d3.curveBasis},
					{name:"curveBasisOpen", algo: d3.curveBasisOpen},
					{name:"curveBasisClosed", algo: d3.curveBasisClosed}, 
					{name:"curveBundle", algo: d3.curveBundle},
					{name:"curveCardinal", algo: d3.curveCardinal},
					{name:"curveCardinalOpen", algo: d3.curveCardinalOpen},
					{name:"curveCardinalCloed", algo: d3.curveCardinalClosed},
					{name:"curveNatural", algo: d3.curveNatural},
					{name:"curveMonotoneX", algo: d3.curveMonotoneX},
					{name:"curveCatmullRom", algo: d3.curveCatmullRom}
				];
			},
			getInterpolationName: function() {
				return this.getInterpolation().map(function(x) { return x.name });
			},
			normalizeCustom: function(state) {
				if (!state.x) {
					Vue.set(state, "x", null);
				}
				if (!state.areaOpacity) {
					Vue.set(state, "areaOpacity", 0);			
				}
				if (!state.strokeWidth) {
					state.strokeWidth = 3;
				}
				if (!state.xFormat) {
					Vue.set(state, "xFormat", {});
				}
				if (!state.zFormat) {
					Vue.set(state, "zFormat", {});
				}
				if (!state.y) {
					Vue.set(state, "y", null);
				}
				if (!state.yFormat) {
					Vue.set(state, "yFormat", {});
				}
				if (!state.z) {
					Vue.set(state, "z", null);
				}
				if (!state.rotateX) {
					Vue.set(state, "rotateX", 0);
				}
				if (!state.yLabel) {
					Vue.set(state, "yLabel", null);
				}
				if (!state.fromColor) {
					Vue.set(state, "fromColor", "#99c7fd");
				}
				if (!state.toColor) {
					Vue.set(state, "toColor", "#f09980");
				}
				if (!state.legend) {
					Vue.set(state, "legend", false);
				}
				if (!state.sortBy) {
					Vue.set(state, "sortBy", null);
				}
				if (!state.reverseSortBy) {
					Vue.set(state, "reverseSortBy", false);
				}
				if (!state.interpolation) {
					Vue.set(state, "interpolation", null);
				}
				if (!state.pointRadius) {
					Vue.set(state, "pointRadius", 0);
				}
			},
			drawLineAtMouse: function(svg, width, height, margin, x, y,data, color, zValues) {
				var self = this;
				var mouseG = svg.append("g")
					.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
					.attr("class", "mouse-over-effects");
				
				mouseG.append("path") // this is the black vertical line to follow mouse
					.attr("class", "mouse-line")
					.style("stroke", "#666")
					.style("stroke-width", "1px")
					.style("stroke-dasharray", "5,5")
					.style("opacity", "0");
					
				mouseG.append("text")
					.attr("class", "line-x-value");
				
				var lines = self.$el.getElementsByClassName('line');
				
				var mousePerLine = mouseG.selectAll('.mouse-per-line')
					.data(data)
					.enter()
					.append("g")
					.attr("class", function(d, i) { return "mouse-per-line mouse-per-line-" + i });
				
				mousePerLine.append("circle")
					.attr("r", 7)
					.style("stroke", function(d) {
						return color(zValues.length ? zValues.indexOf(d.name) : 0);
					})
					.attr("class", "highlight-circle")
					.style("fill", "none")
					.style("stroke-width", "2px")
					.style("opacity", "0");
				
				mousePerLine.append("rect")
					// positions on top
					//.attr("transform", "translate(-15,-10)");
					// positions to the right
					.attr("class", "highlight-rectangle")
					.style("fill", "white")
					.style("opacity", "0")
					.attr("transform", "translate(12,-7)");
				
				mousePerLine.append("text")
					// positions on top
					//.attr("transform", "translate(-15,-10)");
					// positions to the right
					.attr("class", "inline-information highlight-text")
					.attr("transform", "translate(15,3)");
					
				
				mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
					.attr('width', width) // can't catch mouse events on a g element
					.attr('height', height)
					.attr('fill', 'none')
					.attr('pointer-events', 'all')
					.on('mouseout', function() { // on mouse out hide line, circles and text
						d3.select(self.$el).select(".mouse-line")
							.style("opacity", "0");
						d3.select(self.$el).selectAll(".highlight-circle")
							.style("opacity", "0");
						d3.select(self.$el).selectAll(".highlight-text")
							.style("opacity", "0");
						d3.select(self.$el).selectAll(".highlight-rectangle")
							.style("opacity", "0");
						d3.select(self.$el).selectAll(".line-x-value")
							.style("opacity", "0");
					})
					.on('mouseover', function() { // on mouse in show line, circles and text
						d3.select(self.$el).select(".mouse-line")
							.style("opacity", "1");
						d3.select(self.$el).selectAll(".highlight-circle")
							.style("opacity", "1");
						d3.select(self.$el).selectAll(".highlight-text")
							.style("opacity", "1");
						d3.select(self.$el).selectAll(".highlight-rectangle")
							.style("opacity", "1");
						d3.select(self.$el).selectAll(".line-x-value")
							.style("opacity", "1");
					})
					.on('mousemove', function() { // mouse moving over canvas
						var mouse = d3.mouse(this);
						d3.select(self.$el).select(".mouse-line")
							.attr("d", function() {
								var d = "M" + mouse[0] + "," + height;
								d += " " + mouse[0] + "," + 0;
								return d;
							});
						d3.select(self.$el).select(".line-x-value")
							.attr("transform", function() {
								return "translate(" + (mouse[0] + 10) + ",0)";
							})
							.text(function() {
								var value = x.invert ? x.invert(mouse[0]) : x.domain()[self.getIndexFor(margin, x, mouse[0])];
								return self.cell.state.xFormat ? self.$services.formatter.format(value, self.cell.state.xFormat) : value;
							});
							
						// correct for the margin (slightly lazy correction...)
						mouse[0] -= margin.left;
						
						d3.select(self.$el).selectAll(".mouse-per-line")
							.attr("transform", function(d, i) {
								// perhaps interesting if x is also linear instead of band?
								// with the band scale we can determine the index with the getindexfor function
								//var xDate = x.invert(mouse[0]),
								//bisect = d3.bisector(function(d) { return d.date; }).right;
								//idx = bisect(d.values, xDate);
								
								// total length == width?
								var beginning = 0,
									end = lines[i].getTotalLength(),
									target = null;
						
								while (true){
									target = Math.floor((beginning + end) / 2);
									pos = lines[i].getPointAtLength(target);
									if ((target === end || target === beginning) && pos.x !== mouse[0]) {
										break;
									}
									if (pos.x > mouse[0]) {
										end = target;
									}
									else if (pos.x < mouse[0]) {
										beginning = target;
									}
									//position found
									else {
										break;
									}
								}
						
								if (x.invert) {
									var value = x.invert(mouse[0] + margin.left);
									var index = -1;
									for (var i = 0; i < d.values.length; i++) {
										// the x axis is ordered in time, so the first time we are above the x value, that is the index
										if (i < d.values.length - 1 && value.getTime() < (d.values[i].label.getTime() + (d.values[i+1].label.getTime()-d.values[i].label.getTime())/2)) {
											index = i;
											break;
										}
										else if (i == d.values.length - 1) {
											index = i;
											break;
										}
									}
								}
								else {
									var index = self.getIndexFor(margin, x, mouse[0]);
									index = Math.min(index, d.values.length - 1);
								}
								
								var div = document.createElement("div");
								//self.buildToolTip(d.values[index].data).$mount().$appendTo(div);
								div.innerHTML = self.buildSimpleToolTip(self.cell.state.y)(d.values[index].data);
								var text = div.innerHTML.replace(/<[^>]+>/g, "");
								
								if (index < 0) {
									index = 0;
								}
								
								d3.select(this).select('.highlight-text')
									.style("font-weight", "bold")
									.style("fill", function(d) {
										return color(zValues.length ? zValues.indexOf(d.name) : 0);
									})
									.style("font-size", "0.7rem")
									//.text(y.invert(pos.y).toFixed(2));
									//.text(d.values[index].value + " (" + d.values[index].label + ")")
									.text(text);
								
								var box = d3.select(this).select('.highlight-text').node().getBBox();
								
								d3.select(this).select(".highlight-rectangle")
									.attr("width", box.width + 6)
									.attr("height", box.height)
									.style("fill", "#fff")
									.style("stroke-width", "1px")
									.style("stroke", function(d) {
										return color(zValues.length ? zValues.indexOf(d.name) : 0);
									})
								
								// no need to take the margin into effect here, we are using the x position which is relative to the mouseG
								//return "translate(" + mouse[0] + "," + (pos.y  + Math.abs(self.zoomYOffset)) +")";
								// this works great...without zoom
								//return "translate(" + mouse[0] + "," + pos.y +")";
								//return "translate(" + (mouse[0] + margin.left) + "," + y(d.values[index].value) +")";
								return "translate(" + (x(d.values[index].label)) + "," + y(d.values[index].value) +")";
							});
						});
			},
			// for scale bands (where the ticks are distributed evenly over the available space) we can calculate the inverse this way
			getXFor: function(margin, x, position) {
				var index = x.invert ? x.invert(position) : this.getIndexFor(margin, x, position);
				return x.domain()[index];
			},
			getIndexFor: function(margin, x, position) {
				// the step size is correct for the given zoom level
				var stepSize = x.step();
				// however if we are zoomed in, there is (likely) a part invisible to the left, we need to account for those values
				// the offset is negative in this case
				return Math.floor((position + (margin.left * this.zoom) + Math.abs(this.zoomXOffset)) / stepSize);
			},
			drawGrid: function(svg, width, height, margin, x, y) {
				if (this.cell.state.drawGridX) {
					svg.append("g")
						.attr("transform", "translate(" + margin.left + "," + (margin.top + height) + ")")
						.attr("class", "grid grid-x")
						.call(d3.axisBottom(x)
							//.ticks(5)
							.tickSize(-height)
							.tickFormat("")
						)
				}
				
				if (this.cell.state.drawGridY) {
					// add the Y gridlines
					svg.append("g")			
						.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
						.attr("class", "grid grid-y")
						.call(d3.axisLeft(y)
							//.ticks(10)
							.tickSize(-width)
							.tickFormat("")
						);
				}
					
				// change the color of the grid
				d3.select(this.$refs.svg).selectAll(".grid line")
					.style("stroke", "#eaeaea");
					
				// remove the outer most line which acts as the "base" of the axis
				d3.select(this.$refs.svg).selectAll(".grid path")
					.style("opacity", "0");
			}
		},
		watch: {
			records: function(newValue) {
				this.draw();
			},
			cell: {
				handler: function() {
					this.draw();
				},
				deep: true
			}
		}
	});
});
