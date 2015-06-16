app.views = app.views || {};

app.views.HideableRegion = Backbone.Marionette.Region.extend({
    close: function() {
        Backbone.Marionette.Region.prototype.reset.call(this);
//        this.ensureEl();
//        this.$el.hide();
    },
    show: function(view) {
        Backbone.Marionette.Region.prototype.show.call(this, view);
        this.$el.show();
    }
});
