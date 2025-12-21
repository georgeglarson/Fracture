import {Bubble} from './bubble';

export class BubbleManager {

  container;
  bubbles: Record<string, Bubble> = {};

  constructor(container) {
    this.container = container;
  }

  getBubbleById(id) {
    if (id in this.bubbles) {
      return this.bubbles[id];
    }
    return null;
  }

  create(id, message, time) {
    if (this.bubbles[id]) {
      this.bubbles[id].reset(time);
      $('#' + id + ' p').html(message);
    }
    else {
      var el = $('<div id=\"' + id + '\" class="bubble"><p>' + message + '</p><div class="thingy"></div></div>'); //.attr('id', id);
      $(el).appendTo(this.container);

      this.bubbles[id] = new Bubble(id, el, time);
    }
  }

  update(time) {
    var self = this,
      bubblesToDelete: string[] = [];

    Object.values(this.bubbles).forEach(function (bubble: Bubble) {
      if (bubble.isOver(time)) {
        bubble.destroy();
        bubblesToDelete.push(bubble.id);
      }
    });

    bubblesToDelete.forEach(function (id) {
      delete self.bubbles[id];
    });
  }

  clean() {
    var self = this,
      bubblesToDelete: string[] = [];

    Object.values(this.bubbles).forEach(function (bubble: Bubble) {
      bubble.destroy();
      bubblesToDelete.push(bubble.id);
    });

    bubblesToDelete.forEach(function (id) {
      delete self.bubbles[id];
    });

    this.bubbles = {};
  }

  destroyBubble(id) {
    var bubble = this.getBubbleById(id);

    if (bubble) {
      bubble.destroy();
      delete this.bubbles[id];
    }
  }

  forEachBubble(callback) {
    Object.values(this.bubbles).forEach(function (bubble) {
      callback(bubble);
    });
  }
}
