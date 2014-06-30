(function () {
    'use strict';

    function ready() {
        document.removeEventListener("DOMContentLoaded", ready, false);
        var vm = new SDTViewModel(redraw);
        window.sdt_vm = vm;
        redraw(vm);
        ko.applyBindings(vm);
    }

    document.addEventListener('DOMContentLoaded', ready);

    var z_width = 7,
        bottom_margin = 20,
        p_max = 0.5,
        arrow_size = 5;

    function redraw(vm) {
        var graph = document.getElementById('graph'),
            bg_ctx = graph.querySelector('canvas.bg').getContext('2d'),
            fg_ctx = graph.querySelector('canvas.fg').getContext('2d'),
            c_ctx = graph.querySelector('canvas.c').getContext('2d'),
            w = bg_ctx.canvas.width,
            h_full = bg_ctx.canvas.height,
            h = h_full - bottom_margin,
            x, y, z, p;
        function x_z(x) {
            return z_width * x / w - z_width/2;
        }
        function z_x(z) {
            return (z + z_width/2) * (w / z_width);
        }
        function p_y(p) {
            return h - h*p/p_max;
        }

        console.log('redraw', w, h);


        /*** bg layer ***/
        bg_ctx.beginPath();
        bg_ctx.clearRect(0, 0, w, h_full);
        bg_ctx.textAlign = 'center';
        bg_ctx.textBaseline = 'top';
        bg_ctx.font = 'italic 12px sans-serif';
        bg_ctx.strokeStyle = bg_ctx.fillStyle = '#666';
        bg_ctx.lineWidth = 2;

        // labels
        bg_ctx.fillText('Z', w-10, h+5);
        bg_ctx.fillText('p', w/2-10, 5);
        
        // x-axis
        bg_ctx.moveTo(0, h);
        bg_ctx.lineTo(w, h);
        bg_ctx.moveTo(arrow_size, h-arrow_size);
        bg_ctx.lineTo(0, h);
        bg_ctx.lineTo(arrow_size, h+arrow_size);
        bg_ctx.moveTo(w-arrow_size, h-arrow_size);
        bg_ctx.lineTo(w, h);
        bg_ctx.lineTo(w-arrow_size, h+arrow_size);
        for (z = -Math.floor(z_width/2); z <= z_width/2; ++z) {
            x = z_x(z);
            bg_ctx.moveTo(x, h);
            bg_ctx.lineTo(x, h+5);
            bg_ctx.fillText(z.toString(), x, h+5);
        }
        // y-axis
        bg_ctx.moveTo(w/2, h);
        bg_ctx.lineTo(w/2, 0);
        bg_ctx.moveTo(w/2-arrow_size, arrow_size);
        bg_ctx.lineTo(w/2, 0);
        bg_ctx.lineTo(w/2+arrow_size, arrow_size);
        bg_ctx.textBaseline = 'middle';
        bg_ctx.textAlign = 'right';
        for (p = 0.1; p < p_max; p += 0.1) {
            y = p_y(p);
            bg_ctx.moveTo(w/2, y);
            bg_ctx.lineTo(w/2 - 5, y);
            bg_ctx.fillText('0.' + Math.round(10*p), w/2-10, y);
        }
        bg_ctx.stroke();


        /*** fg layer ***/
        fg_ctx.beginPath();
        fg_ctx.clearRect(0, 0, w, h_full);

        // Curves: this could be optimized by caching pdf values.
        var dp2 = vm.d_prime() / 2;
        console.log('dp2:', dp2);

        // target pdf
        fg_ctx.beginPath();
        fg_ctx.moveTo(0, p_y(pdf(x_z(0) - dp2)));
        for (x = 1; x < w; ++x) {
            fg_ctx.lineTo(x, p_y(pdf(x_z(x) - dp2)));
        }
        fg_ctx.strokeStyle = '#0a2';
        fg_ctx.stroke();

        // foil pdf
        fg_ctx.beginPath();
        fg_ctx.moveTo(0, p_y(pdf(x_z(0) + dp2)));
        for (x = 1; x < w; ++x) {
            fg_ctx.lineTo(x, p_y(pdf(x_z(x) + dp2)));
        }
        fg_ctx.strokeStyle = '#a20';
        fg_ctx.stroke();

        // criterion line
        var c_x = z_x(vm.c());
        c_ctx.beginPath();
        c_ctx.clearRect(0, 0, w, h_full);
        c_ctx.moveTo(c_x, 0);
        c_ctx.lineTo(c_x, h+5);
        c_ctx.lineWidth = 2;
        c_ctx.strokeStyle = c_ctx.fillStyle = '#03d';
        c_ctx.stroke();
        c_ctx.font = 'italic 12px sans-serif';
        c_ctx.textAlign = 'center';
        c_ctx.textBaseline = 'top';
        c_ctx.fillText('C', c_x, h+5);
    }

    function SDTViewModel(redraw) {
        var self = this;
        this.prob = {
            hit: observable_hl(0.8),
            miss: computed_hl({
                read: function () {
                    return 1-self.prob.hit();
                },
                write: function (miss) {
                    self.prob.hit(1-miss);
                }
            }),
            fa: observable_hl(0.2),
            cr: computed_hl({
                read: function () {
                    return 1-self.prob.fa();
                },
                write: function (cr) {
                    self.prob.fa(1-cr);
                }
            })
        };
        this.z = {
            hit: computed_hl({
                read: function () {
                    return probit(self.prob.hit());
                },
                write: function (zhit) {
                    self.prob.hit(cdf(zhit));
                }
            }),
            fa: computed_hl({
                read: function () {
                    return probit(self.prob.fa());
                },
                write: function (zfa) {
                    self.prob.fa(cdf(zfa));
                }
            })
        };
        this.d_prime = computed_hl({
            read: function () {
                return self.z.hit() - self.z.fa();
            },
            write: function (dp) {
                var c = self.c();
                self.prob.hit(cdf(c - dp/2));
                self.prob.fa(cdf(dp/2 + c));
            }
        });
        this.d_prime_delayed = ko.computed(this.d_prime).extend({rateLimit: 100});
        this.c = computed_hl({
            read: function () {
                return -(self.z.hit() + self.z.fa())/2;
            },
            write: function (c) {
                var dp = self.d_prime();
                self.z.hit(dp/2 - c);
                self.z.fa(-dp/2 + c);
            }
        });
        this.d_prime_delayed.subscribe(function(dp) {
            redraw(self);
        });
    }

    function observable_hl(val) {
        var o = ko.observable(val);
        o.highlight = ko.observable(false);
        return o;
    }
    function computed_hl(options) {
        options.deferEvaluation = true;
        var o = ko.computed.call(ko, options);
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
