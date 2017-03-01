Number.prototype.mod = function(n) {
   return ((this%n)+n)%n;
}

function Point(x,y) {
  this.x = x;
  this.y = y;
  this.state = 0; // 0 - not in hull, 1 - in hull, 2 - if user point
  this.nextpt = null; // next point (ccw) in hull
}
Point.prototype.sub = function(p2) {
  return new Point(this.x-p2.x, this.y-p2.y);
}
app = {}
app.ptrad = 5;
app.padx = 50, app.pady = 50;

app.random = function(a, b) {
  return (b-a)*Math.random() + a;
}

app.dot = function(p1, p2) {
  return p1.x*p2.x + p1.y*p2.y;
}

app.ccw = function(p1, p2, p3) {
  return (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x)
}

app.init = function(svg) {
  app.canvas = svg;
  app.width = app.canvas.attr('width')-2*app.padx;
  app.height = app.canvas.attr('height')-2*app.pady;
}

app.genpoints = function(n) {
  var points = [];
  for (var i=0; i<n; i++) {
    pt = new Point(app.random(0, app.width)+app.padx,
                   app.random(0, app.height)+app.pady);
    //pt.idx = i;
    points = points.concat(pt); // next point (ccw) in hull
  }
  app.points = points;
}

app.graham_scan = function(points) { // doesn't work
  // step 1: find point P with lowest y coord
  var miny = -1, minidx = -1;
  for(var i in points) {
    if (points[i].y >= miny) {
      if (points[i].y == miny && points[i].x < points[minidx].x)
        minidx = i;
      else
        miny = points[i].y, minidx = i;
    }
  }
  var P = points[minidx];

  // step 2: sort the points by angle wrt P
  points.sort(function(a,b) {
    return app.dot(a,P) - app.dot(b,P);
  });
  //return points;
}

app.monotone_chain = function(points) {
  // step 1: sort points by x coordinate
  points.sort(function(a,b) {return a.x==b.x ? a.y-b.y : a.x - b.x;});

  // step 2a: build lower hull
  var lower = [];
  for(var i in points) {
    while (lower.length >= 2 && app.ccw(lower[1], lower[0], points[i]) <= 0) {
      lower.shift();
    }
    lower.unshift(points[i]);
  }
  // step 2a: build upper hull
  var upper = [];
  for(var i=points.length-1; i>=0; i--) {
    while (upper.length >= 2 && app.ccw(upper[1], upper[0], points[i]) <= 0) {
      upper.shift();
    }
    upper.unshift(points[i]);
  }
  /* distinguish upper and lower hull
  for (var i=0; i<lower.length-1; i++) {
    lower[i].state = -1;
    lower[i].nextpt = lower[i+1];
  }
  for (var i=0; i<upper.length-1; i++) {
    upper[i].state = 1;
    upper[i].nextpt = upper[i+1];
  }
  */
  // merge lower and upper hull
  lower.shift(); // discard last point
  upper.shift(); // discard last point
  var hull = lower.concat(upper);
  app.hull = hull;
  for (var i=0; i<hull.length; i++) {
    var pt = hull[i];
    var prevpt=hull[(i-1).mod(hull.length)],
        nextpt=hull[(i+1).mod(hull.length)];
    if (app.ccw(prevpt, pt, nextpt) != 0) { // check for redundant points
      pt.state = 1;
      pt.nextpt = nextpt;
      console.log('adding');
    }
  }
  return hull;
}

app.draw = function() {
  $('#canvas').empty();
  var pts = app.points;
  app.drawnpts = app.canvas.selectAll('g')
                    .data(pts)
                    .enter()
                    .append('g')
                    .attr("transform",function(d){return "translate("+d.x+","+d.y+")";});
  app.drawnpts.append('circle')
              .attr('r', app.ptrad)
              .style('fill',function(d) {return ['blue','red','black','green'][d.state];})
  app.drawnpts.append("text").text(function(d) {return d.label || "";}).attr("dx","-20");

  for(var i in pts) {
    var pt = pts[i];
    if (pt.state == 1 || pt.state == 3) {
      app.canvas.append('line')
                .attr('x1', pt.x).attr('y1', pt.y)
                .attr('x2', pt.nextpt.x).attr('y2', pt.nextpt.y)
                .attr('stroke-width',2).attr('stroke','black');
    }
  }
}

app.find_coeffs = function(P) {
  for (var i in app.hull) { // reset previous coeff data
    app.hull[i].state = 1;
    app.hull[i].label = "";
  }
  A = app.hull[0];
  for (var i = 1; i < app.hull.length-1; i++) {
    B = app.hull[i];
    C = app.hull[i+1];
    uv = app.point_in_tri(A, B, C, P);
    u = uv[0], v = uv[1];
    if ((u >= 0) && (v >= 0) && (u+v <1)) { // point in triangle
      A.state = 3, B.state = 3, C.state = 3;
      A.label = "A", B.label = "B", C.label = "C";
      // console.log("points", A, B, C);
      return [1-u-v,u,v].map(function(x) {return x.toFixed(2);});
    }
  }
  // console.log("FAILURE");
  return false;
}

app.point_in_tri2 = function(A, B, C, P) { // deprecated
  // http://blackpawn.com/texts/pointinpoly/
  // Compute vectors
  var v0 = C.sub(A),
      v1 = B.sub(A),
      v2 = P.sub(A);
  console.log(v0, v1, v2);
  // Compute dot products
  var dot00 = app.dot(v0, v0),
      dot01 = app.dot(v0, v1),
      dot02 = app.dot(v0, v2),
      dot11 = app.dot(v1, v1),
      dot12 = app.dot(v1, v2);

  // Compute barycentric coordinates
  var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  var u = (dot11 * dot02 - dot01 * dot12) * invDenom,
      v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  // Check if point is in triangle
  // return (u >= 0) && (v >= 0) && (u + v < 1);
  return [u,v];
}

app.point_in_tri = function(A, B, C, P) {
  var expr = function(A, B, C) {
    return (function(P, Q) {return P.x*Q.y-Q.x*P.y;})(A.sub(B), A.sub(C));
  }
  var beta = expr(A, P, C)/expr(A, B, C),
      gamma = expr(A, B, P)/expr(A, B, C);
  return [beta, gamma];
}

$('document').ready(function() {
  app.init(d3.select('svg'));
  $('#gen-pts').click(function() {
    app.hull = null;
    app.genpoints($('#num-pts').val());
    // $('#canvas').empty();
    app.draw();
  });
  $('#make-hull').click(function() {
    app.monotone_chain(app.points);
    // $('#canvas').empty();
    //app.points = app.points.filter(function(p){return p.state;});
    app.draw();
  });
  app.canvas.on('mousemove', function() {
    if (!app.hull) return;
    if (d3.event.defaultPrevented) return;
    var point = d3.mouse(this);
    var p = new Point(point[0], point[1]);
    p.state = 2;
    p.label = "P";
    app.points = app.points.filter(function(p){return p.state!=2;}).concat(p);
    app.draw();
    var coeffs = app.find_coeffs(p);
    if (coeffs) {
      $('#coeffs').text("P = " + coeffs[0] + "*A + " + coeffs[1] + "*B + " + coeffs[2] + "*C");
      $('#sliderA').val(coeffs[0]);
      $('#sliderB').val(coeffs[1]);
      $('#sliderC').val(coeffs[2]);
    } else {
      $('#coeffs').text("P lies outside hull");
      $('#sliderA').val(0);
      $('#sliderB').val(0);
      $('#sliderC').val(0);
    }
    app.draw();
  });
});
