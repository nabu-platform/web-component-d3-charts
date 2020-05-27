if (!nabu) { var nabu = {} }
if (!nabu.page) { nabu.page = {} }
if (!nabu.page.views) { nabu.page.views = {} }
if (!nabu.page.views.data) { nabu.page.views.data = {} }

window.addEventListener("load", function () {
	nabu.page.views.data.Donut = Vue.extend({
		template: "#data-donut",
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
				configuring: false
			}
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
			// based heavily on: https://bl.ocks.org/mbhall88/b2504f8f3e384de4ff2b9dfa60f325e2
			draw: function() {
				var self = this;
				if (this.cell.state.value && this.$refs.svg) {
					var records = this.records.filter(function(record) {
						return !!record[self.cell.state.value];
					});
					
					var midAngle = function(d) { return d.startAngle + (d.endAngle - d.startAngle) / 2; }
					// the gap between the slices
					var padAngle = 0.015;
					
					// the border radius of the slices
					var cornerRadius = 3;
					
					var margin = {top: 10, right: 10, bottom: 10, left: 10};
					
					// default color scheme
					var colour = d3.scaleOrdinal(d3.schemeCategory20c);
					
					var color = d3.scaleLinear()
						.domain([0, records.length])
						.range([this.fromColor, this.toColor])
						.interpolate(d3.interpolateHcl);

					// remove previous drawing (if any)
					nabu.utils.elements.clear(this.$refs.svg);
					
					var svg = d3.select(this.$refs.svg),
						width = this.$el.offsetWidth - 20,
						// reserve some space for title etc
						height = this.$el.offsetHeight - (self.cell.state.title ? 50 : 0);
						
					if (this.cell.state.filterType != null && this.cell.state.filterType.component == "data-combo-filter") {
						height -= 70;
					}
					
					// subtract for actions
					if (self.globalActions.length) {
						height -= 75;
					}
					
					var radius = Math.min(width, height) / 2;
						
					svg.attr('width', width + margin.left + margin.right)
						.attr('height', height + margin.top + margin.bottom);
						
					var pie = d3.pie()
						.sort(null)
						.value(function(record) { return record[self.cell.state.value]; });
						
					var outerFactor = 0.8;
					var innerFactor = outerFactor - (outerFactor * this.arcWidth);
					
					// inner arc for values
					var arc = d3.arc()
						.outerRadius(radius * outerFactor)
						.innerRadius(radius * innerFactor)
						.cornerRadius(cornerRadius)
						.padAngle(padAngle);
						
					// this arc is used for aligning the text labels
					var outerArc = d3.arc()
						.outerRadius(radius * 0.9)
						.innerRadius(radius * 0.9);
						
					var inlineToolTipHTML = function(d) {
						var html = "";
						var counter = 0;
						for (var index in self.keys) {
							var key = self.keys[index];
							if (!self.isHidden(key)) {
								html += "<tspan x='0'" + (counter++ == 0 ? "" : " dy='1.2rem' ") 
									+ "class='property'><tspan class='key'>" 
									+ (self.cell.state.result[key].label ? self.cell.state.result[key].label : key) 
									+ ": </tspan><tspan class='value'>" 
									+ self.interpret(key, d.data[key]) + "</tspan></tspan>";
							}
						}
						return html;
					}
					
					var buildToolTip = function(d) {
						return self.buildSimpleToolTip(self.cell.state.value)(d.data);
					};
					
					var toolTip = function(selection) {
						// add tooltip (svg circle element) when mouse enters label or slice
						selection.on('mouseenter', function (data, i) {
							if (!self.cell.state.detail || self.cell.state.detail == 'inline') {
								// if the inner radius becomes too small, we can't really display text on it, switch to a solid
								var circleRadius = radius * (innerFactor * 0.95);
								
								svg.append('circle')
									.attr('class', 'toolCircle')
									.attr('r', circleRadius) // radius of tooltip circle
									.style('fill', color(i)) // colour based on category mouse is over
									.style('fill-opacity', 0.35)
									.attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
									
								svg.append('text')
									.attr('class', 'toolCircle')
									.attr('dy', -15) // hard-coded. can adjust this to adjust text vertical alignment in tooltip
									.html(inlineToolTipHTML(data)) // add text to the circle.
									.style('font-size', '.9em')
									.style('text-anchor', 'middle')
									.attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')'); // centres text in tooltip
							}
							else {
								self.$services.dataUtils.buildStandardD3Tooltip(data, i, buildToolTip);
							}
						});
							
						// remove the tooltip when mouse leaves the slice/label
						selection.on('mouseout', function () {
							if (!self.cell.state.detail || self.cell.state.detail == 'inline') {
								d3.selectAll('.toolCircle').remove();
							}
							else {
								self.$services.dataUtils.removeStandardD3Tooltip();
							}
						});
					}
						
					// separate elements to keep things modular
					svg.append('g').attr('class', 'slices')
						.attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
					svg.append('g').attr('class', 'labelName')
						.attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
					svg.append('g').attr('class', 'lines')
						.attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
					
					// add and color the slices
					var path = svg.select('.slices')
						.datum(records).selectAll("path")
						.data(pie)
						.enter().append("path")
						.attr('fill', function(d, i) { return color(i); return colour(d.data[self.cell.state.label ? self.cell.state.label : self.cell.state.value]); })
						.attr('d', arc);
						
					// add labels
					var label = svg.select('.labelName')
						.datum(records).selectAll("text")
						.data(pie)
						.enter().append('text')
						.attr('label-index', function(d, i) { return i })
						.attr('dy', '.35em')
						.html(function(d, i) {
							var value = "";
							if (self.cell.state.label) {
								value = d.data[self.cell.state.label];
								if (self.cell.state.labelFormat) {
									var original = value;
									value = self.$services.formatter.format(value, self.cell.state.labelFormat);
									self.$services.dataUtils.watchValue(original, self.cell.state.labelFormat, svg, i);
								}
							}
							else {
								value = d.data[self.cell.state.value];
							}
							return value + (self.cell.state.unit ? "<tspan>" + self.cell.state.unit + "</tspan>" : "");
						})
						.attr('transform', function(d) {
							// effectively computes the centre of the slice.
							// see https://github.com/d3/d3-shape/blob/master/README.md#arc_centroid
							var pos = outerArc.centroid(d);
							
							// changes the point to be on left or right depending on where label is.
							pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
							return 'translate(' + pos + ')';
						})
						.style('text-anchor', function(d) {
							// if slice centre is on the left, anchor text to start, otherwise anchor to end
							return (midAngle(d)) < Math.PI ? 'start' : 'end';
						});
						
					// add lines connecting labels to slice. A polyline creates straight lines connecting several points
					var polyline = svg.select('.lines')
						.datum(records).selectAll('polyline')
						.data(pie)
						.enter().append('polyline')
						.attr('points', function(d) {
							// see label transform function for explanations of these three lines.
							var pos = outerArc.centroid(d);
							pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
							return [arc.centroid(d), outerArc.centroid(d), pos]
					});
					
					// too wide! multiple donuts possible
					//d3.selectAll('.labelName text, .slices path').call(toolTip);
					svg.selectAll(".labelName text, .slices path").call(toolTip);
				}
			},
			normalizeCustom: function(state) {
				if (!state.value) {
					Vue.set(state, "value", null);
				}
				if (!state.label) {
					Vue.set(state, "label", null);
				}
				if (!state.unit) {
					Vue.set(state, "unit", null);
				}
				if (!state.fromColor) {
					Vue.set(state, "fromColor", null);
				}
				if (!state.toColor) {
					Vue.set(state, "toColor", null);
				}
				if (!state.arcWidth) {
					Vue.set(state, "arcWidth", 30);
				}
				if (!state.detail) {
					Vue.set(state, "detail", 'popup');
				}
				if (!state.labelFormat) {
					Vue.set(state, "labelFormat", {});
				}
			}
		},
		watch: {
			records: function(newValue) {
				this.draw();
			}
		}
	});
});
