/*jslint browser: true, nomen: true, indent: 4, maxlen: 80 */
/*global jQuery, _, Backbone, window, OpenLayers, CodeMirror, document */

(function ($) {
    'use strict';
    $("#ol-map").height(window.innerHeight);

    var MapConfig = Backbone.Model.extend({}),
        olMap = new OpenLayers.Map({
            div: 'ol-map',
            allOverlays: true,
            controls: [
                new OpenLayers.Control.Navigation()
            ],
            layers: [
                new OpenLayers.Layer.OSM()
            ]
        }),
        smashList = function (list) {
            return _.reduce(
                list,
                function (a, f) {
                    a[f.name] = f.value;
                    return a;
                },
                {}
            );
        },
        updateModelviaForm = function () {
            var fields = this.$el.find('form').serializeArray();
            this.model.set(smashList(fields));
            this.remove();
        },
        DataSet = Backbone.Model.extend({}),
        DataSetList = Backbone.Collection.extend({
            model: DataSet
        }),
        Style = Backbone.Model.extend({}),
        StyleList = Backbone.Collection.extend({
            model: Style,
        }),
        Layer = Backbone.Model.extend({}),
        LayerList = Backbone.Collection.extend({
            model: Layer
        }),
        // make some global instances of these models and collections
        Datasets = new DataSetList(),
        Styles   = new StyleList(),
        Layers   = new LayerList(),
        Map      = new MapConfig(),
        LayerEditWidget = Backbone.View.extend({
            tagName: 'div',
            className: 'modal',
            template: _.template($('#layerEditTemplate').html()),
            events: {
                'click #close': 'remove',
                'click #delete': 'delete',
                'click #update': updateModelviaForm
            },
            delete: function () {
                Layers.remove(this.model);
                this.remove();
            },
            render: function () {
                this.$el.html(this.template({
                    layer: this.model.toJSON(),
                    styles: Styles.toJSON()
                }));
                return this;
            }
        }),
        LayerElement = Backbone.View.extend({
            tagName: 'li',
            template: _.template($('#layerTreeTemplate').html()),
            className: 'layer-element',

            events: {
                'click .show-metadata': 'updateLayer',
                'click .toggle-view-p': 'toggleMapView'
            },

            initialize: function () {
                this.listenTo(this.model, 'change', this.render);
            },
            updateLayer: function () {
                var editWidget = new LayerEditWidget({
                    model: this.model
                }).render();
                $('body').append(editWidget.$el);
            },
            toggleMapView: function () {
                var visible = this.model.get('visible');

                if (visible) {
                    this.model.set('visible', false);
                } else {
                    this.model.set('visible', true);
                }

            },
            render: function () {
                this.$el.html(this.template(this.model.toJSON()));
                this.$el.data('name', this.model.get('name'));
                return this;
            }
        }),
        LayerTree = Backbone.View.extend({
            el: '#layer-tree',

            events: {
//                'dragstart div': 'dragStart',
//                'dragend div': 'dragEnd'
            },

            dragEnd: function (evt) {
                var name = $(evt.currentTarget);
                console.log('drag end');
                console.log(name.data('name'));
            },
            dragStart: function (evt) {
                var name = $(evt.currentTarget);
                console.log('drag start');
                console.log(name.data('name'));
            },

            initialize: function () {
                this.ul = this.$el.find('ul#local-layers');
                this.collection.bind('add', this.render, this);
                this.collection.bind('remove', this.render, this);
            },

            render: function () {
                var self = this;
                self.ul.empty();
                this.collection.each(function (layer) {
                    var view = new LayerElement({model: layer});
                    self.ul.append(view.render().$el);
                });
                return this;
            }
        }),
        StyleSelector = Backbone.View.extend({
            el: '#style-selector',
            template: _.template($('#styleSelectorTemplate').html()),
            events: {
                'change': 'select'
            },
            initialize: function () {
                this.collection.bind('add', this.render, this);
            },
            getActiveStyle: function () {
                var name = this.$el.find('option:selected').data('name');
                return _.first(this.collection.where({name: name}));
            },
            select: function (evt) {
                var style = this.getActiveStyle();
                if (style) {
                    this.options.editor.setValue(style.get('body'));
                }
            },
            render: function () {
                this.$el.html(this.template({
                    styles: this.collection.toJSON()
                }));
                return this;
            }
        }),

        EditPropertiesWidget = Backbone.View.extend({
            tagName: 'div',
            className: 'modal',
            template: _.template($('#edit-properties-template').html()),
            events: {
                'click #close': 'remove',
                'click #save': updateModelviaForm
            },
            render: function () {
                this.$el.html(this.template(this.model.toJSON()));
                $('body').append(this.$el);
                return this;
            }
        }),

        MapInfo = Backbone.View.extend({
            el: '#map-info',
            template: _.template($('#mapInfoTemplate').html()),
            events: {
                'click #map-properties' : 'properties',
                'click #zoom-in': 'zoomIn',
                'click #zoom-out': 'zoomOut'
            },
            zoomIn: function () {
                this.options.olMap.zoomIn();
            },
            zoomOut: function () {
                this.options.olMap.zoomOut();
            },
            properties: function () {
                var edit = new EditPropertiesWidget({
                    model: this.model
                });
                edit.render();

            },
            initialize: function () {
                var self = this;
                this.model.bind('change', this.render, this);
                this.options.olMap.events.on({
                    'move': function () {
                        self.render();
                    }
                });
            },
            render: function () {
                this.$el.html(this.template({
                    zoom: this.options.olMap.getZoom(),
                    title: this.model.get('title')
                }));
                return this;
            }
        }),

        AddLayerWidget = Backbone.View.extend({
            tagName: 'div',
            className: 'modal',
            template: _.template($('#add-layer-info').html()),
            events: {
                'click #close': 'remove',
                'click #add': 'addToMap',
                'click #search': 'search',
                'click li.dataset-element': 'addToMap'
            },
            search: function () {
                console.log('search');
            },
            addToMap: function (evt) {
                var eln = $(evt.currentTarget),
                    id   = eln.data('id'),
                    name = eln.data('name');

                this.options.layers.add({
                    name: name,
                    style: 1, // hard code for now
                    about: '',
                    visible: true // when you add a layer you always
                    // want to see it. 
                });
            },
            render: function () {
                this.$el.html(this.template({
                    datasets: this.options.datasets.toJSON(),
                    styles: this.options.styles.toJSON()
                }));
                $('body').append(this.$el);
            }
        }),
        StyleEditor = Backbone.View.extend({
            tagName: 'div'
        }),
        MapToolBar = Backbone.View.extend({
            el: '#map-tool-bar',
            events: {
                'click #map-properties': 'showMapProperities',
                'click #add-layer': 'addLayer',
            },
            showMapProperities: function () {
            },
            addLayer: function () {

            }

        });

    $(function () {
        var styleSelector,
            setMapCenter = function (olMap) {
                var hash = window.location.hash,
                    parts = hash.replace('#', '').split('/');
                parts = _.map(parts, function (p) { return +p; });

                olMap.setCenter([parts[1], parts[2]], parts[0]);
            },

            // editor = CodeMirror.fromTextArea(document.getElementById("code"), {
            //     lineNumbers: true,
            //     matchBrackets: true,
            //     theme: "twilight",
            //     mode: "text/x-yaml",
            //     onKeyEvent: function (editor, evt) {
            //         var style;
            //         if (evt.type === 'keypress') {
            //             style = styleSelector.getActiveStyle();
            //             if (style) {
            //                 style.set('body', editor.getValue());
            //             }
            //         }
            //     }

            // }),

            info = new MapInfo({
                model: Map,
                olMap: olMap
            }),
            mapToolBar = new MapToolBar({
                model: Map
            }),
            layerTree = new LayerTree({
                collection: Layers,
                olMap: olMap
            }),
            setSideBar = function () {
                var sideBar = $('#layer-tree-wrapper'),
                    header  = $('#header');

                sideBar.css('top', header.height());
                // add extra value to subtract from overall height of
                // sidebar. this is a magic number find out why 10
                // seems to work
                sideBar.height($(window).height() - header.height() - 10);
            },
            layerTreeWrapper = $('#layer-tree-wrapper'),
            showSideBar = $('#show-side-bar').hide();

        $('#hide-side-bar').click(function () {
            layerTreeWrapper.hide();
            showSideBar.show();
        });

        showSideBar.click(function () {
            layerTreeWrapper.show();
            showSideBar.hide();
        });


        $('#add-layer').click(function () {
            new AddLayerWidget({
                layers: Layers,
                datasets: Datasets,
                styles: Styles
            }).render();
        });

        // set and resize the side bar. TODO make this into a class
        setSideBar();
        $(window).resize(function () {
            $("#ol-map").height(window.innerHeight);
            setSideBar();

        });


        olMap.events.on({
            'move': function (evt) {
                var m = evt.object,
                    zoom = m.getZoom(),
                    center = m.getCenter();
                window.location.hash = '#' + zoom + '/' +
                    center.lon + '/' + center.lat;
            }
        });

        setMapCenter(olMap);


        styleSelector = new StyleSelector({
            collection: Styles,
//            editor: editor
        });

        $('#newStyle').click(function (evnt) {
            Styles.add({
                name: 'Random style' + Date.now(),
                body: '#more content'
            });
        });

        Map.set({
            title: 'Test map',
            about: 'This is a test map',
            bgcolor: '#fff',
            projection: 'EPSG:900913'
        });

        Datasets.add([
            {
                name: 'Counties'
            }
        ]);


        Styles.add([
            {
                id: 1,
                name: 'style one',
                body: ''
            },
            {
                id: 2,
                name: 'style two',
                body: '/* An comment in css */'
            }
        ]);

        Layers.add([
            {
                id: 1,
                name: 'Planet Line OSM',
                style: 1,
                about: 'This is an about text that concerns the layer',
                visible: true
            },
            {
                id: 2,
                style: 'style one',
                name: 'test name',
                about: 'This is an about text for this file',
                visible: false
            }
        ]);

    });

}(jQuery));
