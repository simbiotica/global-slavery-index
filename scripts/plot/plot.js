  /**
   *  Plot view
   *
   *  Example:
   *
   *  var plotView = new slavery.Plot({
   *    el: $('.plot-wrapper')
   *  });
   */

  var m, margin_h, w, h;

  slavery.ui.view.Plot = cdb.core.View.extend({

    initialize: function() {
      // this.template = cdb.templates.getTemplate('chart/views/chart.jst.js');
      var template = $("#plot-template").html();

      this.template = new cdb.core.Template({
        template: template
      });

      this.render();

      this._initViews();
      this._initBindings();
    },

    render: function() {
      this.$el.append(this.template.render());
      return this;
    },

    _drawPlot: function() {
      $('.chart').empty();

      m = 40;
      margin_h = 63 + 60;
      w = (window.innerWidth > 940) ? window.innerWidth : 940;
      h = window.innerHeight - margin_h;

      var svg = d3.select(".chart")
        .append("svg")
        .attr("width", w)
        .attr("height", h+m);

      this.svg = svg;

      var dataset = this.dataset,
          domain = this.domain;

      var x_scale = d3.scale.linear()
        .range([m, w-m])
        .domain(domain);

      var x_invert_scale = d3.scale.linear()
        .range([w-m, m])
        .domain(domain);

      var x_scale_ = (this.column === 'corruption_index') ? x_invert_scale : x_scale;

      var y_scale = d3.scale.linear()
        .range([h, m+m])
        .domain([0,d3.max(dataset, function(d) { return d.y; })]);

      this.y_scale = y_scale;

      var r_scale = d3.scale.linear()
        .range([5, 30]) // max ball radius
        .domain([0, d3.max(dataset, function(d) { return d.radius; })])

      // x axis
      var x_axis = d3.svg.axis().scale(x_scale_).ticks(8);
      svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + (h-m+m) + ")")
        .call(x_axis);

      svg.append("text")
        .attr("class", "x label")
        .attr("id", "x_label")
        .attr("x", m)
        .attr("y", h+20)
        .text(this.x_title);

      // y axis
      var y_axis = d3.svg.axis().scale(y_scale).orient("left").ticks(4);
      svg.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate("+m+", 0 )").call(y_axis);

      svg.append("text")
        .attr("class", "y label")
        .attr("x", -h)
        .attr("y", m-10)
        .attr("transform", "rotate(-90)")
        .text("PREVALENCE RANK");

      // grid
      svg.selectAll("line.grid_v").data(y_scale.ticks(4)).enter()
        .append("line")
        .attr({
          "class": "grid grid_v",
          "x1": 0,
          "x2": w,
          "y1": function(d){ return y_scale(d); },
          "y2": function(d){ return y_scale(d); }
        });

      svg.selectAll("line.grid_h").data(x_scale_.ticks(8)).enter()
        .append("line")
        .attr({
          "class": "grid grid_h",
          "y1": 0,
          "y2": h,
          "x1": function(d){ return x_scale_(d); },
          "x2": function(d){ return x_scale_(d); }
        });

      this.linearRegressionLine(svg, dataset, x_scale_, y_scale);

      // circles
      var circle_attr = {
        "cx": function(d) { return x_scale_(d.x); },
        "cy": function(d) { return y_scale(d.y); },
        "r": function(d) { return r_scale(d.radius) },
        "class": function(d) { return d.region ; }
      };

      var circles = svg.selectAll("circle")
        .data(dataset)

      circles.enter()
        .append("circle")
        .attr(circle_attr)
        .on('mouseenter', function(e, j, u) {
          d3.select(d3.event.target)
            .transition()
            .attr('r', function(d) { return circle_attr.r(d) + 5; })
            .style('opacity', 1);

          d3.selectAll(".tipsy")
            .transition()
              .style("opacity","0")
              .remove();

          svg
            .append('svg:text')
            .style("opacity", "0")
            .attr("class", "tipsy")
            .attr("x", function() {return d3.select(d3.event.target).attr("cx");})
            .attr("y", function() {return d3.select(d3.event.target).attr("cy");})
            .style("text-anchor", "middle")
            .text(function(d) { return e.name + " ("+e.rank.toFixed(1)+")"; })
            .transition()
              .style("opacity","1")
              .attr("y", d3.select(d3.event.target).attr("cy")-r_scale(e.radius)-18);

        }).on('mouseout', function() {
          d3.select(d3.event.target)
            .transition()
            .attr('r', function(d) { return circle_attr.r(d); })
            .style('opacity', .6);

          d3.select(".tipsy")
            .transition()
              .style("opacity","0")
              .remove();
        });
    },

    _initViews: function() {
      var self = this;

      this.graph_selector = new slavery.ui.view.GraphSelector({
        el: this.$(".graph_selector")
      });

      this.addView(this.graph_selector);

      this.help = new slavery.ui.view.Help({
        el: this.$(".plot_help")
      });

      this.addView(this.help);

      this.dataset = [],
      this.column = "";

      //TODO: TAKE NOTE OF THE RADIUS VARIABLE!
      d3.json('http://globalslavery.cartodb.com/api/v2/sql?q=SELECT human_development_index AS x, rank AS y, rank, gdppp AS radius, name, region FROM new_index_numbers WHERE gdppp IS NOT NULL', function(dataset) {
        var dataset = dataset.rows;
        self.dataset = dataset;

        self.domain = [d3.min(dataset, function(d) {return d.x}), d3.max(dataset, function(d) { return d.x; })];

        self.x_title = "HUMAN DEVELOPMENT INDEX";
        self.description = "HUMAN DEVELOPMENT INDEX";

        self._drawPlot();
      });
    },

    linearRegressionLine: function(svg, dataset, x_scale, y_scale) {
      // linear regresion line
      var lr_line = ss.linear_regression()
        .data(dataset.map(function(d) { return [d.x, d.y]; }))
        .line();

      var line = d3.svg.line()
        .x(x_scale)
        .y(function(d) { return y_scale(lr_line(d));} )

      var x0 = x_scale.domain()[0];
      var x1 = x_scale.domain()[1];
      var lr = svg.selectAll('.linear_regression').data([0]);

      var attrs = {
         "x1": x_scale(x0),
         "y1": y_scale(lr_line(x0)),
         "x2": x_scale(x1),
         "y2": y_scale(lr_line(x1)),
         "stroke-width": 1.3,
         "stroke": "white",
         "stroke-dasharray": "7,5"
      };

      lr.enter()
        .append("line")
         .attr('class', 'linear_regression')
         .attr(attrs);

      lr.transition().attr(attrs);
    },

    _bindOnResize: function() {
      var self = this;

      $(window).resize(function() {
        self._drawPlot();
      });
    },

    _initBindings: function() {
      this._bindOnResize();
      this.graph_selector.bind("updateview", this._updateView, this);
    },

    _updateView: function(graph){
      var self = this;

      this.column = graph.get('column');

      d3.json('http://globalslavery.cartodb.com/api/v2/sql?q=SELECT ' + this.column + ' AS x, rank AS y, rank, gdppp AS radius, name, region FROM new_index_numbers WHERE gdppp IS NOT NULL', function(dataset) {
        var dataset = dataset.rows;
        self.dataset = dataset;

        var domain = (self.column === 'corruption_index') ? [d3.max(dataset, function(d) { return d.x; }), d3.min(dataset, function(d) {return d.x}), ] : [d3.min(dataset, function(d) {return d.x}), d3.max(dataset, function(d) { return d.x; })]
        self.domain = domain;

        var x_scale = d3.scale.linear()
          .range([m, w-m])
          .domain(domain);

        var x_invert_scale = d3.scale.linear()
          .range([w-m, m])
          .domain(domain);

        var x_scale_ = (self.column === 'corruption_index') ? x_invert_scale : x_scale;

        self.x_scale = x_scale_;

        self.linearRegressionLine(self.svg, dataset, x_scale_, self.y_scale);

        var circles = d3.selectAll('circle')
          .data(dataset)
          .transition()
            .attr("cx",function(d) { return x_scale_(d.x); })

        d3.select("#x_label")
          .text(graph.get('title'));

        d3.select(".chart_description")
          .text(graph.get('description'));
      })
    }
  });
