import {App} from './app';
import {Game} from './game';
import {Detect} from './utils/detect';
import {VolumeUI} from './ui/volume-ui';
import {TitleAnimation} from './ui/title-animation';
import * as _ from 'lodash';


var app, game;
var volumeUI: VolumeUI;

var initApp = function () {
  $(function () {
    app = new App();
    app.center();

    // Initialize cinematic title animation
    const titleAnim = new TitleAnimation();
    titleAnim.init().catch(err => console.warn('[TitleAnimation] Error:', err));

    if (Detect.isWindows()) {
      // Workaround for graphical glitches on text
      $('body').addClass('windows');
    }

    if (Detect.isOpera()) {
      // Fix for no pointer events
      $('body').addClass('opera');
    }

    $('body').click(function (event) {
      if ($('#parchment').hasClass('credits')) {
        app.toggleCredits();
      }

      if ($('#parchment').hasClass('about')) {
        app.toggleAbout();
      }
    });

    $('.barbutton').not('#mutebutton').click(function () {
      $(this).toggleClass('active');
    });

    $('#chatbutton').click(function () {
      if ($('#chatbutton').hasClass('active')) {
        app.showChat();
      } else {
        app.hideChat();
      }
    });

    $('#helpbutton').click(function () {
      app.toggleInstructions();
    });

    $('#inventorybutton').click(function () {
      if (game && game.ready && game.started) {
        game.toggleInventory();
      }
    });

    $('#minimapbutton').click(function () {
      if (game && game.ready && game.started) {
        game.toggleMinimap();
      }
    });

    $('#newspaperbutton').click(function () {
      if (game && game.ready && game.started) {
        game.toggleNewspaper();
      }
    });

    $('#achievementsbutton').click(function () {
      // Use game's achievements menu (same as J key)
      if (game && game.ready && game.started) {
        game.toggleAchievements();
      }
      if (app.blinkInterval) {
        clearInterval(app.blinkInterval);
      }
      $(this).removeClass('blink');
    });

    $('#instructions').click(function () {
      app.hideWindows();
    });

    $('#playercount').click(function () {
      app.togglePopulationInfo();
    });

    $('#population').click(function () {
      app.togglePopulationInfo();
    });

    $('.clickable').click(function (event) {
      event.stopPropagation();
    });

    $('#toggle-credits').click(function () {
      app.toggleCredits();
    });

    $('#create-new span').click(function () {
      app.animateParchment('loadcharacter', 'confirmation');
    });

    $('.delete').click(function () {
      app.storage.clear();
      app.animateParchment('confirmation', 'createcharacter');
    });

    $('#cancel span').click(function () {
      app.animateParchment('confirmation', 'loadcharacter');
    });

    $('.ribbon').click(function () {
      app.toggleAbout();
    });

    $('#nameinput').bind('keyup', function () {
      app.toggleButton();
    });

    $('#notifications div').bind('transitioned', app.resetMessagesPosition.bind(app));

    $('.close').click(function () {
      app.hideWindows();
    });

    $('.twitter').click(function () {
      var url = $(this).attr('href');

      app.openPopup('twitter', url);
      return false;
    });

    $('.facebook').click(function () {
      var url = $(this).attr('href');

      app.openPopup('facebook', url);
      return false;
    });

    var data = app.storage.data;
    if (data.hasAlreadyPlayed) {
      if (data.player.name && data.player.name !== '') {
        $('#playername').html(data.player.name);
        $('#playerimage').attr('src', data.player.image);
      }
    }

    $('.play div').click(function (event) {
      var nameFromInput = $('#nameinput').val(),
        nameFromStorage = $('#playername').html(),
        name = nameFromInput || nameFromStorage,
        password = ($('#passwordinput').val() as string) || '';

      app.tryStartingGame(name, password, null);
    });

    document.addEventListener('touchstart', function () {
    }, false);

    $('#resize-check').bind('transitionend', app.resizeUi.bind(app));
    $('#resize-check').bind('webkitTransitionEnd', app.resizeUi.bind(app));
    $('#resize-check').bind('oTransitionEnd', app.resizeUi.bind(app));

    console.info('App initialized.');

    initGame();
  });
};

var initGame = function () {

  var canvas = document.getElementById('entities'),
    background = document.getElementById('background'),
    foreground = document.getElementById('foreground'),
    input = document.getElementById('chatinput');

  game = new Game(app);
  game.setup('#bubbles', canvas, background, foreground, input);
  game.setStorage(app.storage);
  app.setGame(game);

  if (app.isDesktop && app.supportsWorkers) {
    game.loadMap();
  }

  game.onGameStart(function () {
    app.initEquipmentIcons();
    // Initialize mute button state once audio manager is ready
    if (volumeUI) {
      volumeUI.initMuteButtonState();
    }
  });

  game.onDisconnect(function (message) {
    $('#death').find('p').html(message + '<em>Please reload the page.</em>');
    $('#respawn').hide();
  });

  game.onPlayerDeath(function () {
    if ($('body').hasClass('credits')) {
      $('body').removeClass('credits');
    }
    $('body').addClass('death');
  });

  game.onPlayerEquipmentChange(function () {
    app.initEquipmentIcons();
  });

  game.onPlayerInvincible(function () {
    $('#hitpoints').toggleClass('invincible');
  });

  game.onNbPlayersChange(function (worldPlayers, totalPlayers) {
    var setWorldPlayersString = function (string) {
        $('#instance-population').find('span:nth-child(2)').text(string);
        $('#playercount').find('span:nth-child(2)').text(string);
      },
      setTotalPlayersString = function (string) {
        $('#world-population').find('span:nth-child(2)').text(string);
      };

    $('#playercount').find('span.count').text(worldPlayers);

    $('#instance-population').find('span').text(worldPlayers);
    if (worldPlayers == 1) {
      setWorldPlayersString('player');
    } else {
      setWorldPlayersString('players');
    }

    $('#world-population').find('span').text(totalPlayers);
    if (totalPlayers == 1) {
      setTotalPlayersString('player');
    } else {
      setTotalPlayersString('players');
    }
  });

  game.onAchievementUnlock(function (id, name, description) {
    app.unlockAchievement(id, name);
  });

  game.onNotification(function (message) {
    app.showMessage(message);
  });

  app.initHealthBar();
  app.initXpBar();
  app.initGoldDisplay();

  $('#nameinput').attr('value', '');
  $('#chatbox').attr('value', '');

  if (game.renderer.mobile || game.renderer.tablet) {
    $('#foreground').bind('touchstart', function (event) {
      app.center();
      // app.setMouseCoordinates(event.originalEvent.touches[0]);
      game.click();
      app.hideWindows();
    });
  } else {
    $('#foreground').click(function (event) {
      app.center();
      app.setMouseCoordinates(event);
      if (game) {
        game.click();
      }
      app.hideWindows();
      // $('#chatinput').focus();
    });

    // Right-click handler for player context menu
    $('#foreground').on('contextmenu', function (event) {
      event.preventDefault();
      app.setMouseCoordinates(event);
      if (game) {
        game.rightClick(event.pageX, event.pageY);
      }
    });
  }

  $('body').unbind('click');
  $('body').click(function (event) {
    var hasClosedParchment = false;

    if ($('#parchment').hasClass('credits')) {
      if (game.started) {
        app.closeInGameCredits();
        hasClosedParchment = true;
      } else {
        app.toggleCredits();
      }
    }

    if ($('#parchment').hasClass('about')) {
      if (game.started) {
        app.closeInGameAbout();
        hasClosedParchment = true;
      } else {
        app.toggleAbout();
      }
    }

    if (game.started && !game.renderer.mobile && game.player && !hasClosedParchment) {
      game.click();
    }
  });

  $('#respawn').click(function (event) {
    game.audioManager.playSound('revive');
    game.restart();
    $('body').removeClass('death');
  });

  $(document).mousemove(function (event) {
    app.setMouseCoordinates(event);
    if (game.started) {
      game.movecursor();
    }
  });

  $(document).keydown(function (e) {
    var key = e.which,
      $chat = $('#chatinput');

    if (key === 13) {
      if ($('#chatbox').hasClass('active')) {
        app.hideChat();
      } else {
        app.showChat();
      }
    }
  });

  $('#chatinput').keydown(function (e) {
    var key = e.which,
      $chat = $('#chatinput');

    if (key === 13) {
      if ($chat.attr('value') !== '') {
        if (game.player) {
          game.say($chat.attr('value'));
        }
        $chat.attr('value', '');
        app.hideChat();
        $('#foreground').focus();
        return false;
      } else {
        app.hideChat();
        return false;
      }
    }

    if (key === 27) {
      app.hideChat();
      return false;
    }
  });

  // Handle Enter key on both name and password inputs
  $('#nameinput, #passwordinput').keypress(function (event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      var name = ($('#nameinput').val() as string) || '',
        password = ($('#passwordinput').val() as string) || '';

      if (name !== '') {
        app.tryStartingGame(name, password, function () {
          $('#nameinput').blur();
          $('#passwordinput').blur();
        });
      }
      return false;
    }
  });

  // Initialize volume UI
  volumeUI = new VolumeUI();
  volumeUI.setCallbacks({
    getAudioManager: () => game.audioManager,
    getStorage: () => game.storage
  });

  $('#mutebutton').click(function (e) {
    e.stopPropagation();
    // Just toggle the panel - mute control is inside the panel
    volumeUI.toggle();
  });

  $(document).bind('keydown', function (e) {
    var key = e.which,
      $chat = $('#chatinput');

    console.log('[KeyDown] Key pressed:', key, 'chatinput focused:', $('#chatinput:focus').length, 'nameinput focused:', $('#nameinput:focus').length);

    if ($('#chatinput:focus').length == 0 && $('#nameinput:focus').length == 0) {
      if (key === 13) { // Enter
        if (game.ready) {
          $chat.focus();
          return false;
        }
      }
      if (key === 32) { // Space
        // game.togglePathingGrid();
        return false;
      }
      if (key === 70) { // F
        // game.toggleDebugInfo();
        return false;
      }
      if (key === 27) { // ESC
        app.hideWindows();
        _.each(game.player.attackers, function (attacker) {
          attacker.stop();
        });
        return false;
      }
      if (key === 78) { // N - Toggle Town Crier newspaper
        if (game.ready && game.started) {
          game.toggleNewspaper();
        }
        return false;
      }
      if (key === 88) { // X - Drop current weapon (changed from D for WASD)
        console.log('[KeyPress] X key pressed, game.ready:', game.ready, 'game.started:', game.started);
        if (game.ready && game.started) {
          game.dropCurrentWeapon();
        }
        return false;
      }
      // WASD and Arrow keys for movement
      if (key === 87 || key === 38) { // W or Up Arrow
        if (game.ready && game.started && game.player) {
          game.movePlayerInDirection(0, -1);
        }
        return false;
      }
      if (key === 65 || key === 37) { // A or Left Arrow
        if (game.ready && game.started && game.player) {
          game.movePlayerInDirection(-1, 0);
        }
        return false;
      }
      if (key === 83 || key === 40) { // S or Down Arrow
        if (game.ready && game.started && game.player) {
          game.movePlayerInDirection(0, 1);
        }
        return false;
      }
      if (key === 68 || key === 39) { // D or Right Arrow
        if (game.ready && game.started && game.player) {
          game.movePlayerInDirection(1, 0);
        }
        return false;
      }
      // Q key - Use first consumable (flask/food)
      if (key === 81 && game.ready && game.started) { // Q
        game.useFirstConsumable();
        return false;
      }
      if (key === 73) { // I - Toggle inventory
        console.log('[KeyPress] I key pressed, game.ready:', game.ready, 'game.started:', game.started);
        // Toggle inventory even if game isn't ready - the UI should still show
        game.toggleInventory();
        return false;
      }
      if (key === 74) { // J - Toggle achievements
        game.toggleAchievements();
        return false;
      }
      if (key === 77) { // M - Toggle minimap
        if (game.ready && game.started) {
          game.toggleMinimap();
        }
        return false;
      }
      if (key === 191 || key === 112) { // ? (forward slash with shift) or F1 - Help
        app.toggleInstructions();
        return false;
      }
    } else {
      if (key === 13 && game.ready) {
        $chat.focus();
        return false;
      }
    }
  });

  if (game.renderer.tablet) {
    $('body').addClass('tablet');
  }
};

initApp();


declare global {
  interface Window {
    requestAnimFrame: any;
    Worker: any,
    MozWebSocket: any
  }
}
