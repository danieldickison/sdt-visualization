(function () {
    'use strict';

    function ready() {
        document.removeEventListener("DOMContentLoaded", ready, false);
        redraw();
    }

    document.addEventListener('DOMContentLoaded', ready);

    function redraw() {
        var graph = document.getElementById('graph'),
            bg_ctx = graph.querySelector('canvas.bg').getContext('2d'),
            fg_ctx = graph.querySelector('canvas.fg').getContext('2d'),
            w = bg_ctx.canvas.width,
            h = bg_ctx.canvas.height;
        function x_z(x) {
            return 8 * x / w - 4;
        }
        function p_y(p) {
            return h - 20 - (h-20)*p;
        }

        console.log('redraw', w, h);

        bg_ctx.clearRect(0, 0, w, h);
        fg_ctx.clearRect(0, 0, w, h);
        
        // Axes
        bg_ctx.moveTo(0, h-20);
        bg_ctx.lineTo(w, h-20);
        bg_ctx.strokeStyle = '#00f';
        bg_ctx.stroke();

        bg_ctx.moveTo(w/2, h-20);
        bg_ctx.lineTo(w/2, 0);
        bg_ctx.strokeStyle = '#00f';
        bg_ctx.stroke();

        fg_ctx.moveTo(0, p_y(pdf(x_z(0))));
        for (var x = 1; x < w; ++x) {
            fg_ctx.lineTo(x, p_y(pdf(x_z(x))));
        }
        fg_ctx.stroke();
    }

    function SDTViewModel() {
        var self = this;
        this.prob = {
            hit: highlightable(0.8),
            miss: highlightable(0.2),
            fa: highlightable(0.2),
            cr: highlightable(0.8)
        };
        this.z = {
            hit: highlightable(),
            fa: highlightable(),
        };
        this.d_prime = highlightable();
        this.c = highlightable();


    }

    function highlightable() {
        var o = ko.observable();
        o.highlight = ko.observable(false);
        return o;
    }

    function pdf(x) {
        return 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-Math.pow(x,2) / 2.0);
    }

    // https://en.wikipedia.org/wiki/Normal_distribution#Generating_values_from_normal_distribution
    // Approximation from Zelen & Severo.
    function cdf(x) {
        var b0 = 0.2316419, b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
        var t = 1.0 / (1.0 + b0 * x);
        var p = Math.pow;
        return 1.0 - pdf(x) * (b1*t + b2*p(t,2) + b3*p(t,3) + b4*p(t,4) + b5*p(t,5));
    }

    // http://home.online.no/~pjacklam/notes/invnorm/
    var probit = (function () {
        var a1 = -3.969683028665376e+01;
        var a2 =  2.209460984245205e+02;
        var a3 = -2.759285104469687e+02;
        var a4 =  1.383577518672690e+02;
        var a5 = -3.066479806614716e+01;
        var a6 =  2.506628277459239e+00;
        var b1 = -5.447609879822406e+01;
        var b2 =  1.615858368580409e+02;
        var b3 = -1.556989798598866e+02;
        var b4 =  6.680131188771972e+01;
        var b5 = -1.328068155288572e+01;
        var c1 = -7.784894002430293e-03;
        var c2 = -3.223964580411365e-01;
        var c3 = -2.400758277161838e+00;
        var c4 = -2.549732539343734e+00;
        var c5 =  4.374664141464968e+00;
        var c6 =  2.938163982698783e+00;
        var d1 =  7.784695709041462e-03;
        var d2 =  3.224671290700398e-01;
        var d3 =  2.445134137142996e+00;
        var d4 =  3.754408661907416e+00;
        return function probit(p) {
            var q, r;
            if (p < 0.02425) {
                q = Math.sqrt(-2*Math.log(p));
                return (((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6) / ((((d1*q+d2)*q+d3)*q+d4)*q+1);
            }
            else if (p > 1 - 0.02425) {
                q = Math.sqrt(-2*Math.log(1-p));
                return -(((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6) / ((((d1*q+d2)*q+d3)*q+d4)*q+1);
            }
            else {
                q = p - 0.5;
                r = q*q;
                return (((((a1*r+a2)*r+a3)*r+a4)*r+a5)*r+a6)*q / (((((b1*r+b2)*r+b3)*r+b4)*r+b5)*r+1);
            }
        };
    })();
})();
