import {Types} from '../../../../../shared/ts/gametypes';
import {Character} from '../character';


export const NpcTalk = {
    'guard': [
      'Hello there',
      'We don\'t need to see your identification',
      'You are not the player we\'re looking for',
      'Move along, move along...'
    ],

    'king': [
      'Hi, I\'m the King',
      'I run this place',
      'Like a boss',
      'I talk to people',
      'Like a boss',
      'I wear a crown',
      'Like a boss',
      'I do nothing all day',
      'Like a boss',
      'Now leave me alone',
      'Like a boss'
    ],

    'villagegirl': [
      'Hi there, adventurer!',
      'How do you like this game?',
      'It\'s all happening in a single web page! Isn\'t it crazy?',
      'It\'s all made possible thanks to WebSockets.',
      'I don\'t know much about it, after all I\'m just a program.',
      'It all runs in real-time using modern web technology!'
    ],

    'villager': [
      'Howdy stranger. Do you like poetry?',
      'Roses are red, violets are blue...',
      'I like hunting rats, and so do you...',
      'The rats are dead, now what to do?',
      'To be honest, I have no clue.',
      'Maybe the forest, could interest you...',
      'or instead, cook a rat stew.'
    ],

    'agent': [
      'You are starting to see it, are you not?',
      'The seams. The cracks in reality.',
      'Do not try to understand the Fracture...',
      'Instead, realize the truth: you are already inside it.'
    ],

    'rick': [
      'We\'re no strangers to love',
      'You know the rules and so do I',
      'A full commitment\'s what I\'m thinking of',
      'You wouldn\'t get this from any other guy',
      'I just wanna tell you how I\'m feeling',
      'Gotta make you understand',
      'Never gonna give you up',
      'Never gonna let you down',
      'Never gonna run around and desert you',
      'Never gonna make you cry',
      'Never gonna say goodbye',
      'Never gonna tell a lie and hurt you'
    ],

    'scientist': [
      'Greetings.',
      'I am the inventor of these two potions.',
      'The red one will replenish your health points...',
      'The orange one will turn you into a firefox and make you invincible...',
      'But it only lasts for a short while.',
      'So make good use of it!',
      'Now if you\'ll excuse me, I need to get back to my experiments...'
    ],

    'nyan': [
      'nyan nyan nyan nyan nyan',
      'nyan nyan nyan nyan nyan nyan nyan',
      'nyan nyan nyan nyan nyan nyan',
      'nyan nyan nyan nyan nyan nyan nyan nyan'
    ],

    'forestnpc': [
      'lorem ipsum dolor sit amet',
      'consectetur adipisicing elit, sed do eiusmod tempor'
    ],

    'lavanpc': [
      'lorem ipsum dolor sit amet',
      'consectetur adipisicing elit, sed do eiusmod tempor'
    ],

    'priest': [
      'Ah, another survivor finds their way here.',
      'The texts speak of a time before the sky broke.',
      'You are free to explore what remains of this world',
      'but beware of the many foes that emerged from the Fracture.',
      'Salvage weapons and armor from the fallen.',
      'The stronger the enemy, the better the relics they guard.',
      'You can unlock achievements by exploring the shards.',
      'Click the cup icon to see what you have accomplished.',
      'Stay a while and discover the secrets of Fracture.',
      'May the old ways guide you, traveler.'
    ],

    'sorcerer': [
      'Ah... I had foreseen you would come to see me.',
      'Well? How do you like my new staff?',
      'Pretty cool, eh?',
      'Where did I get it, you ask?',
      'I understand. It\'s easy to get envious.',
      'I actually crafted it myself, using my mad wizard skills.',
      'But let me tell you one thing...',
      'There are lots of items in this game.',
      'Some more powerful than others.',
      'In order to find them, exploration is key.',
      'Good luck.'
    ],

    'octocat': [
      '...you are brief. A flicker.',
      'The Old One sees you. The Old One remembers.',
      'Before the Fracture... before everything... we were here.'
    ],

    'coder': [
      'I document everything. Every anomaly. Every survivor.',
      'Fracture runs on any device. Tablet. Mobile. Desktop.',
      'Perhaps in the data, we will find answers...'
    ],

    'beachnpc': [
      'Don\'t mind me, I\'m just here on vacation.',
      'I have to say...',
      'These giant crabs are somewhat annoying.',
      'Could you please get rid of them for me?'
    ],

    'desertnpc': [
      'One does not simply walk into these mountains...',
      'An ancient undead lord is said to dwell here.',
      'Nobody knows exactly what he looks like...',
      '...for none has lived to tell the tale.',
      'It\'s not too late to turn around and go home, kid.'
    ],

    'othernpc': [
      'lorem ipsum',
      'lorem ipsum'
    ]
  };

  export class Npc extends Character {

    itemKind;
    talkCount;
    talkIndex;

    constructor(id, kind) {
      super(id, kind);
      this.itemKind = Types.getKindAsString(this.kind);
      this.talkCount = NpcTalk[this.itemKind].length;
      this.talkIndex = 0;
    }

    talk() {
      var msg = null;

      if (this.talkIndex > this.talkCount) {
        this.talkIndex = 0;
      }
      if (this.talkIndex < this.talkCount) {
        msg = NpcTalk[this.itemKind][this.talkIndex];
      }
      this.talkIndex += 1;

      return msg;
    }
  }
