if (!nabu) { var nabu = {} }
if (!nabu.page) { nabu.page = {} }
if (!nabu.page.views) { nabu.page.views = {} }
if (!nabu.page.views.data) { nabu.page.views.data = {} }

window.addEventListener("load", function () {
	nabu.page.views.data.Gauge = Vue.extend({
		template: "#data-gauge",
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
		methods: {
			configure: function() {
				this.configuring = true;	
			},
			normalizeCustom: function(state) {
				if (!state.valueColor) {
					Vue.set(state, "valueColor", "#99c7fd");
				}
				if (!state.totalColor) {
					Vue.set(state, "totalColor", "#dedede");
				}
				if (state.round == null) {
					Vue.set(state, "round", 0);
				}
			},
			// based heavily on: https://bl.ocks.org/mbhall88/b2504f8f3e384de4ff2b9dfa60f325e2
			draw: function() {
				var self = this;
				if (this.cell.state.value && this.$refs.svg) {
					var records = this.records.filter(function(record) {
						return !!record[self.cell.state.value];
					});
					
					// remove previous drawing (if any)
					nabu.utils.elements.clear(this.$refs.svg);

					var margin = {top: 10, right: 10, bottom: 10, left: 10};
					
					var svg = d3.select(this.$refs.svg),
						width = this.$el.offsetWidth - margin.right - margin.left,
						// reserve some space for title etc
						height = this.$el.offsetHeight - (self.cell.state.title ? 50 : 0),
						radius = Math.min(width, height) / 2;
						
					svg.attr('width', width + margin.left + margin.right)
						.attr('height', height + margin.top + margin.bottom);
					
					// one chart per record
					var chartWidth = (width / this.records.length) - margin.left;
					// never be wider than it is tall, otherwise it can stretch
					chartWidth = Math.min(height, chartWidth);
					
					// extract to settings?
					var barWidth = 40 * chartWidth / 300;
					var totalPercent = .75;
					var padRad = 0.025;
					
					var percToDeg = function(perc) {
						return perc * 360;
					};
					
					var percToRad = function(perc) {
						return degToRad(percToDeg(perc));
					};
					
					var degToRad = function(deg) {
						return deg * Math.PI / 180;
					};
					
					// the charts may not take the full width, we want to center the g depending on the remaining space
					var remainder = (width - (chartWidth * this.records.length)) / 2;
					
					// main canvas
					var g = svg.append("g")
						.attr("transform", "translate(" + (((chartWidth + margin.left) / 2) + remainder) + "," + ((height + margin.top) / 2) + ")");
					
					/** 
					* Helper function that returns the `d` value
					* for moving the needle
					**/
					var recalcPointerPos = function(perc) {
						var thetaRad = percToRad(perc / 2);
						var centerX = 0;
						var centerY = 0;
						var topX = centerX - this.len * Math.cos(thetaRad);
						var topY = centerY - this.len * Math.sin(thetaRad);
						var leftX = centerX - this.radius * Math.cos(thetaRad - Math.PI / 2);
						var leftY = centerY - this.radius * Math.sin(thetaRad - Math.PI / 2);
						var rightX = centerX - this.radius * Math.cos(thetaRad + Math.PI / 2);
						var rightY = centerY - this.radius * Math.sin(thetaRad + Math.PI / 2);
						return "M " + leftX + " " + leftY + " L " + topX + " " + topY + " L " + rightX + " " + rightY;
					};
					
					var Needle = function Needle(el, chartWidth) {
						this.el = el;
						this.len = chartWidth / 3;
						this.radius = this.len / 6;
					}
					
					Needle.prototype.render = function() {
						this.el.append('circle')
							.attr('class', 'needle-center')
							.attr('cx', 0)
							.attr('cy', 0)
							.attr('r', this.radius);
						return this.el.append('path')
							.attr('class', 'needle')
							.attr('d', recalcPointerPos.call(this, 0));
					};
					
					Needle.prototype.moveTo = function(perc, repaintGauge) {
						var self,
						oldValue = this.perc || 0;
						
						this.perc = perc;
						self = this;
						
						// Reset pointer position
						this.el.transition().delay(100).ease(d3.easeCubic).duration(200).select('.needle').tween('reset-progress', function() {
							return function(percentOfPercent) {
								var progress = (1 - percentOfPercent) * oldValue;
								repaintGauge(progress);
								
								return self.el.select(".needle").attr('d', recalcPointerPos.call(self, progress));
							};
						});
						
						this.el.transition().delay(300).ease(d3.easeBounce).duration(1500).select('.needle').tween('progress', function() {
							return function(percentOfPercent) {
								var progress = percentOfPercent * perc;
								
								repaintGauge(progress);
								return self.el.select(".needle").attr('d', recalcPointerPos.call(self, progress));
							};
						});
					}
					
					this.records.map(function(record, index) {
						var chart = g.append("g")
						
						chart.append('path')
							.attr('class', "arc chart-filled")
							.attr("fill", self.cell.state.valueColor)
							
						chart.append('path')
							.attr('class', "arc chart-empty")
							.attr("fill", self.cell.state.totalColor)
							
						// assumes margin top & left are bout the same
						arc2 = d3.arc().outerRadius(radius - margin.left).innerRadius(radius - margin.left - barWidth);
						arc1 = d3.arc().outerRadius(radius - margin.left).innerRadius(radius - margin.left - barWidth);
						
						var repaintGauge = function (percent)  {
							var nextStart = totalPercent;
							arcStartRad = percToRad(nextStart);
							arcEndRad = arcStartRad + percToRad(percent / 2);
							nextStart += percent / 2;
							
							arc1.startAngle(arcStartRad).endAngle(arcEndRad);
							
							arcStartRad = percToRad(nextStart);
							arcEndRad = arcStartRad + percToRad((1 - percent) / 2);
							
							arc2.startAngle(arcStartRad + padRad).endAngle(arcEndRad);
							
							chart.select(".chart-filled").attr('d', arc1);
							chart.select(".chart-empty").attr('d', arc2);
						}
						
						chart.attr("transform", "translate(" + (chartWidth * index) + ", 0)")

						needle = new Needle(chart, chartWidth);
						needle.render();
						
						var value = record[self.cell.state.value];
						var totalValue = self.cell.state.totalValue ? record[self.cell.state.totalValue] : null;
						
						// we assume a percentage between 0 and 1
						if (totalValue == null) {
							totalValue = 1;
						}
						needle.moveTo(value / totalValue, repaintGauge);
						
						if (self.cell.state.label) {
							var label = record[self.cell.state.label];
							chart.append("text")
								.attr("class", "gauge-title")
								.text(label);
						}
						// if there is no total value field, we assume a percentage
						var unit = self.cell.state.unit;
						if (!unit && !self.cell.state.totalValue) {
							unit = "%";
						}
						if (self.cell.state.showValue) {
							chart.append("text")
								.attr("class", "gauge-value")
								.text(self.$services.formatter.number((!self.cell.state.totalValue ? (value * 100) : value), self.cell.state.round) + (unit ? " " + unit : ""));
						}
					});
					// position the titles & values correctly
					g.selectAll(".gauge-value")
						.attr("transform", function() {
							return "translate(-" + (this.getBBox().width / 2) + ", 45)"
						})
					g.selectAll(".gauge-title")
						.attr("transform", function() {
							return "translate(-" + (this.getBBox().width / 2) + ", " + (self.cell.state.showValue ? 75 : 45) + ")"
						})
				}
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
