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

    ko.bindingHandlers.dragStep = {
        init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
            var y0, y_prev, tracking;

            element.addEventListener('mousedown', function (event) {
                y0 = event.clientY;
                tracking = false;
                document.body.addEventListener('mousemove', drag, false);
                document.body.addEventListener('mouseup', mouseup, false);
                document.body.addEventListener('mouseleave', mouseup, false);
            }, false);

            function getOptions() {
                var options = valueAccessor();
                if (ko.isWriteableObservable(options)) {
                    options = {
                        value: options
                    };
                }
                return options;
            }

            function drag(event) {
                var y = event.clientY,
                    options = getOptions();
                var nullZone = ko.utils.unwrapObservable(options.nullZone) || 2,
                    perPixel = ko.utils.unwrapObservable(options.perPixel) || 0.01;
                if (tracking) {
                    var dy = y - y_prev,
                        dv = -dy * perPixel, // flip y coordinates so up increases value.
                        v0 = options.value();
                    options.value(v0 + dv);
                    options.value.highlight(true);
                }
                else if (Math.abs(y - y0) > nullZone) {
                    tracking = true;
                }
                y_prev = y;
                event.preventDefault();
            }

            function mouseup(event) {
                document.body.removeEventListener('mousemove', drag);
                document.body.removeEventListener('mouseup', mouseup);
                document.body.removeEventListener('mouseleave', mouseup);
            }
        }
    };

    ko.extenders.limitRange = function (target, options) {
        var min = options.min,
            max = options.max;
        return ko.computed({
            read: target,
            write: function(newValue) {
                if (newValue < options.min) {
                    newValue = options.min;
                }
                else if (newValue > options.max) {
                    newValue = options.max;
                }
                target(newValue);
            },
            deferEvaluation: true
        });
    };


    var z_width = 7,
        bottom_margin = 20,
        p_max = 0.5,
        arrow_size = 5,
        target_color = '#092',
        foil_color = '#c37',
        hit_color = '#6f9',
        miss_color = '#aaf',
        fa_color = '#faa',
        cr_color = '#fd8',
        criterion_color = '#03e',
        criterion_line_dash = [6, 3];

    function redraw(vm) {
        var graph = document.getElementById('graph'),
            axes_ctx = graph.querySelector('canvas.axes').getContext('2d'),
            fg_ctx = graph.querySelector('canvas.fg').getContext('2d'),
            c_ctx = graph.querySelector('canvas.c').getContext('2d'),
            hit_ctx = graph.querySelector('canvas.hit').getContext('2d'),
            miss_ctx = graph.querySelector('canvas.miss').getContext('2d'),
            fa_ctx = graph.querySelector('canvas.fa').getContext('2d'),
            cr_ctx = graph.querySelector('canvas.cr').getContext('2d'),
            ctxs = [axes_ctx, fg_ctx, c_ctx, hit_ctx, miss_ctx, fa_ctx, cr_ctx],
            w = axes_ctx.canvas.width,
            h_full = axes_ctx.canvas.height,
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

        for (var i = ctxs.length - 1; i >= 0; i--) {
            ctxs[i].beginPath();
            ctxs[i].clearRect(0, 0, w, h_full);
        }

        /*** bg layer ***/
        axes_ctx.textAlign = 'center';
        axes_ctx.textBaseline = 'top';
        axes_ctx.strokeStyle = axes_ctx.fillStyle = '#666';
        axes_ctx.lineWidth = 2;

        // labels
        axes_ctx.font = 'italic 12px sans-serif';
        axes_ctx.fillText('Z', w-10, h+5);
        axes_ctx.fillText('p', w/2-10, 5);
        
        // x-axis
        axes_ctx.moveTo(0, h);
        axes_ctx.lineTo(w, h);
        axes_ctx.moveTo(arrow_size+2, h-arrow_size);
        axes_ctx.lineTo(1, h);
        axes_ctx.lineTo(arrow_size+2, h+arrow_size);
        axes_ctx.moveTo(w-arrow_size-2, h-arrow_size);
        axes_ctx.lineTo(w-1, h);
        axes_ctx.lineTo(w-arrow_size-2, h+arrow_size);
        axes_ctx.font = '12px sans-serif';
        for (z = -Math.floor(z_width/2); z <= z_width/2; ++z) {
            x = z_x(z);
            axes_ctx.moveTo(x, h);
            axes_ctx.lineTo(x, h+5);
            axes_ctx.fillText(z.toString(), x, h+5);
        }
        // y-axis
        axes_ctx.moveTo(w/2, h);
        axes_ctx.lineTo(w/2, 0);
        axes_ctx.moveTo(w/2-arrow_size, arrow_size+2);
        axes_ctx.lineTo(w/2, 1);
        axes_ctx.lineTo(w/2+arrow_size, arrow_size+2);
        axes_ctx.textBaseline = 'middle';
        axes_ctx.textAlign = 'right';
        for (p = 0.1; p < p_max; p += 0.1) {
            y = p_y(p);
            axes_ctx.moveTo(w/2, y);
            axes_ctx.lineTo(w/2 - 5, y);
            axes_ctx.fillText('0.' + Math.round(10*p), w/2-10, y);
        }
        axes_ctx.stroke();


        /*** curves ***/

        function normal(z_offset, left_ctx, right_ctx, criterion) {
            // This could be optimized by caching pdf values.
            var fill_left = true,
                x = 0,
                z = x_z(x),
                y = p_y(pdf(z + z_offset));
            fg_ctx.beginPath();
            left_ctx.beginPath();
            right_ctx.beginPath();
            fg_ctx.moveTo(0, y);
            left_ctx.moveTo(0, h);
            left_ctx.lineTo(0, y);
            for (x = 1; x <= w; ++x) {
                z = x_z(x);
                y = p_y(pdf(z+ z_offset));
                fg_ctx.lineTo(x, y);
                if (fill_left) {
                    left_ctx.lineTo(x, y);
                    if (z >= criterion) {
                        left_ctx.lineTo(x, h);
                        left_ctx.closePath();
                        fill_left = false;
                        right_ctx.moveTo(x, h);
                        right_ctx.lineTo(x, y);
                    }
                }
                else {
                    right_ctx.lineTo(x, y);
                }
            }
            right_ctx.lineTo(w, h);
            right_ctx.closePath();
            fg_ctx.stroke();
            left_ctx.fill();
            right_ctx.fill();
        }

        var dp2 = vm.d_prime() / 2;

        // target pdf
        fg_ctx.strokeStyle = target_color;
        hit_ctx.fillStyle = hit_color;
        miss_ctx.fillStyle = miss_color;
        normal(-dp2, miss_ctx, hit_ctx, vm.c());

        // foil pdf
        fg_ctx.strokeStyle = foil_color;
        cr_ctx.fillStyle = cr_color;
        fa_ctx.fillStyle = fa_color;
        normal(dp2, cr_ctx, fa_ctx, vm.c());


        // criterion line
        var c_x = z_x(vm.c());
        c_ctx.moveTo(c_x, 0);
        c_ctx.lineTo(c_x, h+5);
        c_ctx.lineWidth = 2;
        c_ctx.strokeStyle = c_ctx.fillStyle = criterion_color;
        c_ctx.setLineDash(criterion_line_dash);
        c_ctx.stroke();
        c_ctx.font = 'italic 12px sans-serif';
        c_ctx.textAlign = 'center';
        c_ctx.textBaseline = 'top';
        c_ctx.fillText('C', c_x, h+5);
    }

    function SDTViewModel(redraw) {
        var self = this;
        this.prob = {
            hit: observable_ui(0.85, 0.01, 0.99),
            miss: computed_ui({
                read: function () {
                    return 1-self.prob.hit();
                },
                write: function (miss) {
                    self.prob.hit(1-miss);
                }
            }, 0.01, 0.99),
            fa: observable_ui(0.3, 0.01, 0.99),
            cr: computed_ui({
                read: function () {
                    return 1-self.prob.fa();
                },
                write: function (cr) {
                    self.prob.fa(1-cr);
                }
            }, 0.01, 0.99)
        };
        this.z = {
            hit: computed_ui({
                read: function () {
                    return probit(self.prob.hit());
                },
                write: function (zhit) {
                    self.prob.hit(cdf(zhit));
                }
            }, -3, 3),
            fa: computed_ui({
                read: function () {
                    return probit(self.prob.fa());
                },
                write: function (zfa) {
                    self.prob.fa(cdf(zfa));
                }
            }, -3, 3)
        };
        this.d_prime = computed_ui({
            read: function () {
                return self.z.hit() - self.z.fa();
            },
            write: function (dp) {
                var c = self.c();
                self.prob.hit(cdf(c - dp/2));
                self.prob.fa(cdf(dp/2 + c));
            }
        }, -6, 6);
        this.c = computed_ui({
            read: function () {
                return -(self.z.hit() + self.z.fa())/2;
            },
            write: function (c) {
                var dp = self.d_prime();
                self.z.hit(dp/2 - c);
                self.z.fa(-dp/2 + c);
            }
        }, -2, 2);
        this.d_prime_delayed = ko.computed(this.d_prime).extend({rateLimit: 100});
        this.d_prime_delayed.subscribe(function(dp) {
            redraw(self);
        });
    }

    function observable_ui(val, min, max) {
        var o = ko.observable(val).extend({limitRange: {min: min, max: max}, notify: 'always'});
        o.highlight = ko.observable(false);
        o.str = ko.computed({
            read: function () {
                return o().toFixed(3);
            },
            write: function (new_val) {
                o(parseFloat(new_val));
            }
        });
        return o;
    }
    function computed_ui(options, min, max) {
        options.deferEvaluation = true;
        var o = ko.computed.call(ko, options).extend({limitRange: {min: min, max: max}});
        o.highlight = ko.observable(false);
        o.str = ko.computed({
            read: function () {
                return o().toFixed(3);
            },
            write: function (new_val) {
                o(parseFloat(new_val));
            },
            deferEvaluation: true
        });
        return o;
    }

    function pdf(x) {
        return 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-Math.pow(x,2) / 2.0);
    }

    // https://en.wikipedia.org/wiki/Normal_distribution#Generating_values_from_normal_distribution
    // Approximation from Zelen & Severo.
    var cdf = (function () {
        var b0 = 0.2316419, b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
        return function cdf(x) {
            var t = 1.0 / (1.0 + b0 * x);
            var p = Math.pow;
            return 1.0 - pdf(x) * (b1*t + b2*p(t,2) + b3*p(t,3) + b4*p(t,4) + b5*p(t,5));
        };
    })();

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
