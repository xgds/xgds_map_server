// __BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

app.views = app.views || {};

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function() { app.vent.trigger('mapmode', 'navigate'); this.updateTip('clear');},
        'click #btn-reposition': function() { app.vent.trigger('mapmode', 'reposition'); this.updateTip('edit');},
        'click #btn-addStations': function() { app.vent.trigger('mapmode', 'addStations'); this.updateTip('add');},
        'click #btn-save': function() { app.simulatePlan(); app.currentPlan.save() },
        'click #btn-saveas': function() { this.showSaveAsDialog(); },
        'click #btn-undo': function() { app.Actions.undo(); },
        'click #btn-redo': function() { app.Actions.redo(); }
    },

    initialize: function() {
        this.listenTo(app.vent, 'mapmode', this.ensureToggle);
    },

    onShow: function() {
        if (!app.State.mapHeightSet) {
            var offset = this.$el.height() +
                parseFloat(this.$el.parent().css('margin-top')) +
                parseFloat(this.$el.parent().css('margin-bottom')) +
                10; // this exact number is needed because jquery ui uses
            // elements with absolute positioning for the resize handles
            var pageContentElement = $('#page-content');
            var oldMapHeight = app.map.$el.height();
            var initialHeight = oldMapHeight - offset;
            app.map.$el.height(initialHeight);
            app.map.$el.css('max-height', initialHeight + 'px');
            $(window).bind('resize', function() {
                app.map.$el.css('max-height', (pageContentElement.height() - offset) + 'px');
            });
            app.State.mapHeightSet = true;
        }
    },

    onRender: function() {
        if (app.Actions.undoEmpty()) {
            this.disableUndo();
        } else {
            this.enableUndo();
        }
        if (app.Actions.redoEmpty()) {
            this.disableRedo();
        } else {
            this.enableRedo();
        }
    },

    disableForReadOnly: function() {
        this.$('#btn-addStations').attr('disabled', 'true');
        this.$('#btn-reposition').attr('disabled', 'true');
        this.$('#btn-save').attr('disabled', 'true');
    },

    disableUndo: function() {
        this.$('#btn-undo').attr('disabled', 'true');
    },

    disableRedo: function() {
        this.$('#btn-redo').attr('disabled', 'true');
    },

    enableUndo: function() {
        this.$('#btn-undo').removeAttr('disabled');
    },

    enableRedo: function() {
        this.$('#btn-redo').removeAttr('disabled');
    },

    ensureToggle: function(modeName) {
        var btn = $('#btn-' + modeName);
        if (! btn.hasClass('active')) { 
            btn.prop("checked", true); 
            btn.addClass('active');
        }
        // turn off the others
        btn.siblings().each(function() {
            $(this).prop("checked", false);
            $(this).removeClass("active");
        });
    },

    updateSaveStatus: function(eventName) {
        var msgMap = {
            'change': 'Unsaved changes.',
            'sync': 'Plan saved.',
            'error': 'Save error.',
            'clear': '',
            'readOnly': 'Plan is LOCKED.'
        };
        if (app.options.readOnly) {
            eventName = 'readOnly';
        }
        if (eventName == 'change') {
            app.dirty = true;
        } else if (eventName == 'sync') {
            app.dirty = false;
        }

        var msg = msgMap[eventName];
        this.$el.find('#save-status').text(msg);
        if (eventName == 'change' || eventName == 'error' || eventName == 'readOnly') {
            this.$el.find('#save-status').addClass('notify-alert');
        } else {
            this.$el.find('#save-status').removeClass('notify-alert');
        }
    },

    updateTip: function(eventName) {
        var msgMap = {
            'edit': 'Shift click to delete stations, click & drag the blue dot to edit.',
            'add': 'Click to add stations to end.  Double-click last station.',
            'clear': 'Click and drag to pan map.'
        };
        var msg = msgMap[eventName];
        this.$el.find('#tip-status').text(msg);
    },

    refreshSaveAs: function(model, response) {
        var text = response.responseText;
        if (response.data != null) {
            var newId = response.data;
            if (newId != null) {
                document.location.href = newId;
            } else {
                app.vent.trigger('sync');
            }
        } else {
            app.vent.trigger('sync');
        }
    },

    
    showSaveAsDialog: function() {
    }

});


app.views.HideableRegion = Backbone.Marionette.Region.extend({
    close: function() {
        Backbone.Marionette.Region.prototype.close.call(this);
        this.ensureEl();
        this.$el.hide();
    },
    show: function(view) {
        Backbone.Marionette.Region.prototype.show.call(this, view);
        this.$el.show();
    }
});

//Grace
app.views.InfoView = Backbone.Marionette.LayoutView.extend({
	template: '#template-properties-form',
    
	events: {
    	'change': 'commitCheck'
    },
    
    modelEvents: {
    	'change' : 'update'
    },
    
    initialize: function(options) {
        this.options = options || {};
        var readOnly = this.options.readOnly || app.options.readOnly;
        var visible = this.options.visible;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        this.options.schema = this.options.schema || this.options.model.schema;
        this.options.data = this.options.data || this.options.model.data;
        this.Field = Backbone.Form.UnitField;
        this.template = Handlebars.compile($(this.template).html());
        var schema = this.options.schema;

        if (readOnly) {
            _.each(schema, function(field, key) {
                field.editorAttrs = {
                    readonly: true,
                    disabled: true
                };
                schema[key] = field;
            });
        }
        Backbone.Form.prototype.initialize.call(this, this.options);
    },
    
    commitCheck: function() {
        Backbone.Form.prototype.commit.apply(this, arguments);
    },
    
    update: function() {
        var attrs = this.model.changedAttributes();
        _.each(_.keys(attrs), function(k) {
            var v = attrs[k];
            this.setValue(k, v);
        }, this);
    }
});


app.views.FeaturesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-features-header'
});

//Grace
app.views.FeaturesView = Backbone.Marionette.LayoutView.extend({
	template: '#template-sequence-view',
	
    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',

        //Column content
        col1: '#col1',
        col2: {
            selector: '#col2',
            regionType: app.views.HideableRegion
        },
    },
	
    initialize: function() {
    	
    },
    
    onClose: function() {
    	this.stopListening();
    },
    
    onRender: function() {
        try {
            this.colhead1.close();
            this.col1.close();
            this.col2.close();
        } catch (err) { 
        	
        }
    	
        var headerView = new app.views.FeaturesHeaderView({
        });
        this.colhead1.show(headerView);
        app.psv = this;
    },
});


app.views.makeExpandable = function(view, expandClass) {
    /*
     * Call this on a view to indicate it is a expandable item in the three-column layout.
     * When the view's 'expand' event is triggered, it will display it's chevron and trigger
     * the global 'viewExpanded' event.  On recieving a global 'viewExpoanded' event with an
     * expandClass that matches its own, the view will remove it's chevron.
     */
    if (app.currentTab != 'sequence') {
        // memory leak work around
        return;
    }
    var expandable = {
        expand: function() {
            this.trigger('expand');
        },
        _expand: function() {
            var expandClass = this.options.expandClass;
            this.expanded = true;
            this._addIcon();
            app.vent.trigger('viewExpanded', this, expandClass);
            if (!_.isUndefined(this.onExpand) && _.isFunction(this.onExpand)) {
                this.onExpand();
            }
        },
        unexpand: function() {
            this.expanded = false;
            this.$el.find('i').removeClass('icon-play');
        },
        onExpandOther: function(target, expandClass) {
            if (this.options.expandClass === expandClass && this != target && target.isClosed != true) {
                this.unexpand();
            }
        },
        _ensureIcon: function() {
            if (view.$el.find('i').length == 0) {
                view.$el.append('<i/>');
            }
        },
        _restoreIcon: function() {
            if (this.expanded) {
                this._addIcon();
            }
        },
        _addIcon: function() {
            this._ensureIcon();
            this.$el.find('i').addClass('icon-play');
        },
        onClose: function() {
            this.stopListening();
        }
    };
    view = _.defaults(view, expandable);
    view.options = _.defaults(view.options, {expandClass: expandClass});
    view.listenTo(app.vent, 'viewExpanded', view.onExpandOther, view);
    view.on('expand', view._expand, view);
    view.on('render', view._restoreIcon, view);
};

app.views.SequenceListItemView = Backbone.Marionette.ItemView.extend({
    // The list item is a simple enough DOM subtree that we'll let the view build its own root element.
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        app.views.makeExpandable(this, this.options.expandClass);
    },
    template: function(data) {
        //return '' + data.model.toString()+ ' <i/>';
        return '{model.toString} <span class="duration">{timing}</span><i/>'.format(data);
    },
    serializeData: function() {
        var data = Backbone.Marionette.ItemView.prototype.serializeData.call(this, arguments);
        data.model = this.model; // give the serialized object a reference back to the model
        data.view = this; // and view
        return data;
    },
    attributes: function() {
        return {
            'data-item-id': this.model.cid,
            'class': this.model.get('type').toLowerCase() + '-sequence-item'
        };
    },
    events: {
        click: function() {
            this.expand();
        }
    },
    modelEvents: {
        'change': 'render'
    }
});

app.views.PathElementItemView = app.views.SequenceListItemView.extend({
    events: {
        click: function() {
            app.State.metaExpanded = true;
            app.State.addCommandsExpanded = false;
            app.State.commandSelected = undefined;
            this.expand();
            var type = this.model.get('type'); // "Station" or "Segment"
            app.vent.trigger('showItem:' + type.toLowerCase(), this.model);
        }
    },
    onExpand: function() {


    },
    serializeData: function() {
        var data = app.views.SequenceListItemView.prototype.serializeData.call(this, arguments);
        if (this.model.get('type') == 'Station') {
            data.timing = app.util.minutesToHMS(this.model.getCumulativeDuration());
        } else {
            data.timing = '+' + app.util.minutesToHMS(this.model.getDuration());
        }
        return data;
    }
});


app.views.CommandItemView = app.views.SequenceListItemView.extend({
    template: function(data) {
        var displayName = data.name || data.presetName || data.presetCode;
        var timing = app.util.minutesToHMS(data.duration);
        return '<input class="select" type="checkbox" id="id_' + displayName + 
        	'"/></i>&nbsp;<label style="display:inline-block;" for="id_' 
        	+ displayName + '">' + displayName + '</label><span class="duration">' 
        	+ timing + '</span><i/>';
    },
    events: function() {
        return _.extend(app.views.SequenceListItemView.prototype.events, {
            'click input.select': this.toggleSelect
        });
    },
    initialize: function(options) {
        this.options = options || {};
        app.views.SequenceListItemView.prototype.initialize.call(this);
    },
    onRender: function() {
        this.$el.css('background-color', app.request('getColor', this.model.get('type')));
    },
    onExpand: function() {
        app.vent.trigger('showItem:command', this.model);
    },
    isSelected: function(evt) {
        return this.$el.find('input.select').is(':checked');
    },
    setSelected: function() {
        this.$el.find('input.select').prop('checked', true);
    },
    setUnselected: function() {
        this.$el.find('input.select').prop('checked', false);
    },
    toggleSelect: function(evt) {
        if (this.isSelected()) {
            this.trigger('selected');
        } else {
            this.trigger('unselected');
        }
        evt.stopPropagation();
    },
    onClose: function() {
        this.stopListening();
    }
});

app.views.MiscItemView = app.views.SequenceListItemView.extend({
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        var options = this.options;
        if (options.extraClass) {
            this.className = this.className ? this.className + ' ' + options.extraClass : options.extraClass;
        }
        this.on('click', function() {this.trigger('expand', this, this.options.expandClass);}, this);
        if (options.click) {
            this.on('click', this.options.click, this);
        }
        app.views.makeExpandable(this, this.options.expandClass);
    },
    render: function() {
        // override default render behavior with nothing, since contents can be pre-rendered in templates
    }
});


app.views.CommandPresetsView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-presets',

    serializeData: function() {
        return {
            presets: this.getRelevantPresets(),
            station: this.model.toJSON()
        };
    },

    events: {
        'click .add-preset': function(evt) {
            var station = this.model;
            var target = $(evt.target);
            var preset = app.commandPresetsByName[target.data('preset-name')];
            app.Actions.disable();
            station.appendCommandByPreset(preset);
            app.Actions.enable();
            app.vent.trigger('change:plan');
        }
    },

    getRelevantPresets: function() {
        var presets;
        // Lists of command types that pertain to Stations and Segments are available in
        // planSchema.StationSequenceCommands and planSchema.SegmentSequenceCommands, respectively
//        var relevantCommandTypes = app.planSchema[this.model.get('type').toLowerCase() + 'SequenceCommands'];
//        if (_.isUndefined(relevantCommandTypes)) {
//            presets = app.planLibrary.commands;
//        } else {
//            presets = _.filter(app.planLibrary.commands, function(command) { return _.contains(relevantCommandTypes, command.type)});
//        }
//        // add timing info in HMS format
//        _.each(presets, function(command) {
//            if (_.has(command, 'duration')) {
//                command.timing = app.util.minutesToHMS(command.duration);
//            }
//        });
//        return presets;
        return null;
    }
});


app.views.FancyTreeView = Backbone.View.extend({
    initialize: function() {
        this.listenTo(app.vent, 'refreshTree', function() {this.refreshTree()});
        var source = $(this.template).html();
        if (_.isUndefined(source))
            this.template = function() {
                return '';
            };
        else {
            this.template = Handlebars.compile(source);
        }
        _.bindAll(this, 'render', 'afterRender'); 
        var _this = this; 
        this.render = _.wrap(this.render, function(render) { 
            render(); 
            _this.afterRender(); 
            return _this; 
        }); 
    },
    template: '#template-layer-tree',
    render: function() {
        this.$el.html(this.template());
    },
    afterRender: function() {
        app.vent.trigger('layerView:onRender');
        if (!_.isUndefined(app.tree)) {
            // only remove if it's there in the first place
            return;
        }
        var layertreeNode = $("#layertree");
        this.createTree();
        return;
    },
    refreshTree: function() {
        if (!_.isUndefined(app.tree)){
            app.tree.reload({
                url: app.options.layerFeedUrl
            }).done(function(){
                //TODO implement
                app.vent.trigger('layerView:reloadKmlLayers');
            });
        }
    },
    createTree: function() {
        if (_.isUndefined(app.tree)){
            var layertreeNode = $("#layertree");
//            layertreeNode.detach();
//            $("#layertreeContainer").append(layertreeNode);
//            layertreeNode = $("#layertree");
            var mytree = layertreeNode.fancytree({
                extensions: ["persist"],
                source: app.treeData,
                checkbox: true,
                select: function(event, data) {
                    if (_.isUndefined(data.node.kmlLayerView)) {
                        // make a new one
                        app.vent.trigger('kmlNode:create', data.node);
                    } else {
                        data.node.kmlLayerView.render();
                    }
                  },
                  persist: {
                      // Available options with their default:
                      cookieDelimiter: "~",    // character used to join key strings
                      cookiePrefix: undefined, // 'fancytree-<treeId>-' by default
                      cookie: { // settings passed to jquery.cookie plugin
                        raw: false,
                        expires: "",
                        path: "",
                        domain: "",
                        secure: false
                      },
                      expandLazy: false, // true: recursively expand and load lazy nodes
                      overrideSource: true,  // true: cookie takes precedence over `source` data attributes.
                      store: "auto",     // 'cookie': use cookie, 'local': use localStore, 'session': use sessionStore
                      types: "active expanded focus selected"  // which status types to store
                    }
            });
            app.tree = layertreeNode.fancytree("getTree");
            app.vent.trigger('tree:loaded');
        }
    }
    
});


app.views.PlanToolsView = Backbone.View.extend({
    template: '#template-plan-tools',
    events: {
        'click #ok-button': 'okClicked',
        'click #btn-reverse': 'reverseStations',
    },
    initialize: function() {
        var source = $(this.template).html();
        if (_.isUndefined(source))
            this.template = function() {
                return '';
            };
        else {
            this.template = Handlebars.compile(source);
        }
        this.listenTo(app.vent, 'clearAppendTool', this.clearAppendTool);
        this.listenTo(app.vent, 'setAppendError', this.setAppendError);
        _.bindAll(this, 'render', 'afterRender'); 
        var _this = this; 
        this.render = _.wrap(this.render, function(render) { 
            render(); 
            _this.afterRender(); 
            return _this; 
        }); 
    },
    render: function() {
        this.$el.html(this.template({
            planIndex: app.planIndex
        }));
    },
    afterRender: function() {
        if (app.options.readOnly) {
            this.disableForReadOnly();
        }
    },
    okClicked: function() {
        var selectPlan = parseInt(this.$('#plan-select').val());
        var planUrl = undefined;
        _.each(app.planIndex, function(plan) {
            if (plan.id == selectPlan) {
                planUrl = plan.url;
            }
        });
        if (_.isUndefined(planUrl))
            // no plan selected
            return;
        this.$('#ok-button').attr('disabled', 'true');
        this.$('#append-error').empty();
        app.reversePlanOnAppend = this.$('#reverse-plan').is(':checked');
        app.prependPlanOnAppend = this.$('#prepend-plan').is(':checked');
        $.getJSON(planUrl).done(this.appendPlan).error(this.failAppendPlan);
    },
    failAppendPlan: function() {
        app.vent.trigger('clearAppendTool');
        app.vent.trigger('setAppendError', 'Error gettting plan to append');
    },
    setAppendError: function(message) {
        this.$('#append-error').empty().append(message);
    },
    clearAppendTool: function() {
        this.$('#ok-button').removeAttr('disabled'); //('disabled','false');
        this.$('#append-error').empty();
        delete app.reversePlanOnAppend;
        delete app.prependPlanOnAppend;
    },
    appendPlan: function(data) {
        console.log(data);
        if (data.sequence.length == 0) {
            // no sequence to add
            app.vent.trigger('clearAppendTool');
            return;
        }
        if (app.reversePlanOnAppend)
            data.sequence.reverse();
        if (app.prependPlanOnAppend && !app.reversePlanOnAppend)
            data.sequence.reverse(); // plan is pushed in reverse order when prepending
        delete app.reversePlanOnAppend;
        var method = undefined;
        var sequence = app.currentPlan.get('sequence').models.slice();
        console.log('number of items');
        console.log(data.sequence.length);
        if (app.prependPlanOnAppend) {
            if (sequence.length > 0) {
                console.log('adding connecting segment');
                var segment = app.models.segmentFactory();
                sequence.unshift(segment);
            }
            while (data.sequence.length > 0) {
                console.log('pushing item');
                console.log(data.sequence.length);
                var item = data.sequence.shift();
                var model = undefined;
                if (item.type == 'Station') {
                    model = app.models.stationFactory(item);
                } else if (item.type == 'Segment') {
                    model = app.models.segmentFactory(item);
                } else {
                    console.log('Error parsing sequence');
                    break;
                }
                sequence.unshift(model);
                console.log('pushed item');
                console.log(data.sequence.length + ' items left');
                console.log(data.sequence.length > 0);
            }
        } else {
            if (sequence.length > 0) {
                console.log('adding connecting segment');
                var segment = app.models.segmentFactory();
                sequence.push(segment);
            }
            while (data.sequence.length > 0) {
                var item = data.sequence.shift();
                var model = undefined;
                if (item.type == 'Station') {
                    model = app.models.stationFactory(item);
                } else if (item.type == 'Segment') {
                    model = app.models.segmentFactory(item);
                } else {
                    console.log('Error parsing sequence');
                    break;
                }
                console.log('pushing item');
                console.log(data.sequence.length);
                sequence.push(model);
                console.log('pushed item');
                console.log(data.sequence.length + ' items left');
                console.log(data.sequence.length > 0);
            }
        }
        delete app.prependPlanOnAppend;
        app.Actions.disable();
        app.currentPlan.get('sequence').models = sequence;
        app.currentPlan.get('sequence').resequence();
        app.vent.trigger('clearAppendTool');
        app.updatePlan(undefined);
        app.Actions.enable();
        app.vent.trigger('change:plan');
    },
    reverseStations: function() {
        app.vent.trigger('plan:reversing');
        app.currentPlan.get('sequence').models.reverse();
        app.currentPlan.get('sequence').resequence();
        app.vent.trigger('plan:reverse');
    },
    disableForReadOnly: function() {
        this.$('#btn-reverse').attr('disabled', 'true');
        this.$('#ok-button').attr('disabled', 'true');
    }
});

app.views.PlanLinksView = Backbone.View.extend({
    template: '#template-plan-links',
    initialize: function() {
        var source = $(this.template).html();
        if (_.isUndefined(source)) {
            this.template = function() {
                return '';
            };
        } else {
            this.template = Handlebars.compile(source);
        }
    },
    render: function() {
        this.$el.html(this.template({
            planLinks: app.planLinks
        }));
    }
});

app.views.TabNavView = Backbone.Marionette.LayoutView.extend({
    template: '#template-tabnav',
    regions: {
        tabTarget: '#tab-target',
        tabContent: '#tab-content'
    },
    events: {
        'click ul.tab-nav li': 'clickSelectTab'
    },

    viewMap: {
    	'layers': app.views.FancyTreeView,
    	'info': app.views.InfoView,
    	'features': app.views.FeaturesView
    },

    initialize: function() {
        this.on('tabSelected', this.setTab);
        this.listenTo(app.vent, 'setTabRequested', function(tabId) {
            this.setTab(tabId);
        });
    },

    onRender: function() {
        if (! this.options.initialTab) {
            this.options.initialTab = 'meta';
        }
        if (!_.isUndefined(app.currentTab)) {
            this.trigger('tabSelected', app.currentTab);
        } else {
            this.trigger('tabSelected', this.options.initialTab);
        }
    },

    clickSelectTab: function(event) {
        var newmode = $(event.target).parents('li').data('target');
        this.trigger('tabSelected', newmode);
    },

    setTab: function(tabId) {
        var oldTab = app.currentTab;
        app.currentTab = tabId;
        var $tabList = this.$el.find('ul.tab-nav li');
        $tabList.each(function() {
            li = $(this);
            if (li.data('target') === tabId) {
                li.addClass('active');
            } else {
                li.removeClass('active');
            }
        });
        var viewClass = this.viewMap[tabId];
        if (! viewClass) { return undefined; }
        var view = new viewClass({
            model: app.currentPlan
        });
        this.tabContent.show(view);

        app.vent.trigger('tab:change', tabId);
    }

});
