"use strict";

const CLOCK_STATE = {
	    IDLE: 'idle',
	    ACTIVE: 'active'
};

class Clock {

	constructor(stage_length) {
		this.state = CLOCK_STATE.IDLE;
		this.start_time = -1;
		this.stage_length = stage_length;
	}

	start() {
		this.state = CLOCK_STATE.ACTIVE;
		this.start_time = new Date().getTime();
	}

	get_elapsed() {
		if(this.start_time < 0) {
			return -1
		} else {
			return new Date().getTime() - this.start_time;
		}
	}

	get_remaining() {
		if(this.start_time < 0) {
			return -1
		} else {
			return this.stage_length - (new Date().getTime() - this.start_time);
		}
	}

	static format_time(time) {
		var options = {minute:'numeric', second:'2-digit'};
		var temp_date = new Date(time)

		var output = temp_date.toLocaleTimeString("en-US", options)

		if(output.length == 5 && output.charAt(0) == "0") {
			output = output.substring(1)
		}

		return output
	}
}

class Stage {
	constructor(id, name, moves, break_timeline) {
		this.id = id;
		this.name = name;
		this.stage_length = 5 * 60 * 1000 + 1000;
		this.moves = moves
		this.break_timeline = break_timeline
		this.break_timings = [[140,145,7], [135,140,1.5]]
	}
}

class Manager {
	constructor(stage) {
		this.stage = stage;
		this.offset = 1800;
		this.min_time_diff = 2500;
		this.reset();
	}

	reset() {
		this.current_move_index = 0;
		this.counter = 0;
		this.clock = new Clock(this.stage.stage_length);
		this.break_state = -1;
		this.queued_moves = []
		this.speech_cache = []
		this.mute = false;
	}

	user_action() {
		if(this.clock.state == CLOCK_STATE.IDLE) {
			this.clock.start();
		} else if (this.clock.state == CLOCK_STATE.ACTIVE) {
			this.break();
		}
	}

	break() {
		this.break_state = 0;
		this.queued_moves = [];
		this.queued_moves.push(this.stage.break_timeline[this.break_state]);

		for (var index = 0; index < this.stage.break_timings.length; index++) {
			var timing = this.stage.break_timings[index]
			var temp_time = this.clock.get_remaining()
			if (temp_time >= timing[0] * 1000 && temp_time < timing[1] * 1000) {
				this.stage.break_timeline[this.stage.break_timeline.length - 1][1] = timing[2]
			}
		}

		if (this.clock.get_elapsed() - 2 * 1000 >= this.counter) {
			this.current_move_index ++;
		}

		while(this.stage.moves[this.current_move_index].length == 3 && this.stage.moves[this.current_move_index][2] == "S") {
			this.current_move_index ++;
		}
		this.counter = this.clock.get_elapsed();
	}

	check_moves() {
		if(this.break_state != -1) {
			if(this.clock.get_elapsed() + this.offset >= this.counter + this.stage.break_timeline[this.break_state][1] * 1000) {
				this.queued_moves = [];

				this.counter += this.stage.break_timeline[this.break_state][1] * 1000;
				if(this.break_state == this.stage.break_timeline.length - 1) {
					this.break_state = -1;
					this.queued_moves.push(this.stage.moves[this.current_move_index]);
				} else {
					this.break_state ++;
					this.queued_moves.push(this.stage.break_timeline[this.break_state]);

					while (this.clock.get_elapsed() + this.offset + this.min_time_diff >= this.counter + this.stage.break_timeline[this.break_state][1] * 1000){
						this.counter += this.stage.break_timeline[this.break_state][1] * 1000;
						if(this.break_state == this.stage.break_timeline.length - 1) {
							this.break_state = -1;
							this.queued_moves.push(this.stage.moves[this.current_move_index]);
							break;
						} else {
							this.break_state ++;
							this.queued_moves.push(this.stage.break_timeline[this.break_state]);
						}
					}
				}
			}
		} else {
			if(this.clock.get_elapsed() + this.offset >= this.counter + this.stage.moves[this.current_move_index][1] * 1000) {
				this.queued_moves = []

				this.counter += this.stage.moves[this.current_move_index][1] * 1000;
				this.current_move_index ++;
				this.queued_moves.push(this.stage.moves[this.current_move_index]);

				while (this.clock.get_elapsed() + this.offset + this.min_time_diff >= this.counter + this.stage.moves[this.current_move_index][1] * 1000){
					this.counter += this.stage.moves[this.current_move_index][1] * 1000;
					this.current_move_index ++;
					this.queued_moves.push(this.stage.moves[this.current_move_index]);
				}
			}
		}
	}

	say(m) {
		var msg = new SpeechSynthesisUtterance();
		var voices = window.speechSynthesis.getVoices();
		msg.voice = voices[48];
		msg.voiceURI = "native";
		msg.volume = 0.8;
		msg.rate = 0.75;
		msg.pitch = 0.80;
		msg.text = m;
		msg.lang = 'en-US';
		setTimeout(function() { window.speechSynthesis.speak(msg); }, 0);
	}

	get_queued_moves_string() {
		if(this.queued_moves.length > 1) {
			var temp_message = "";
			for (var index = 0; index < this.queued_moves.length; index++) {
				if(index == this.queued_moves.length - 1) {
					temp_message += "and " + this.queued_moves[index][0]
				} else {
					temp_message += this.queued_moves[index][0] + ", "
				}
			}
			return temp_message;
		} else {
			return this.queued_moves[0][0]
		}
	}

	read_move() {
		// console.log(this.queued_moves, this.speech_cache)
		if(this.queued_moves.length != 0 && this.queued_moves != this.speech_cache) {
			if(this.mute == false) {
				this.say(this.get_queued_moves_string())
			}
			this.speech_cache = this.queued_moves;
		}
	}
}

const STAGE = {
    hms: new Stage("hms", "High Midgardsormr", []),
    hbh: new Stage("hbh", "High Brunhilda", HBH_moves, [["Break", 10], ["End of Break", 1]]),
    hmc: new Stage("hmc", "High Mercury", [])
}

function select_stage(selected_stage) {
	manager.stage = STAGE[selected_stage];
	manager.reset();
}

// ============================

window.speechSynthesis.onvoiceschanged = function() {
    window.speechSynthesis.getVoices();
};

var current_stage = STAGE.hbh;
var manager = new Manager(current_stage);

function update() {
	document.getElementById("text_stage").innerHTML = manager.stage.name;

	if(manager.clock.state == CLOCK_STATE.IDLE) {
		document.getElementById("text_stage_clock").innerHTML = "Space: when start disappears and on break! || ESC: Reset || Other: Mute.";
		document.getElementById("text_move").innerHTML = "Good luck!";
	}

	if (manager.clock.state ==  CLOCK_STATE.ACTIVE) {
		if (manager.queued_moves.length != 0) {
			document.getElementById("text_move").innerHTML = "Next move: " + manager.get_queued_moves_string();
		}

		var time_left = manager.clock.get_remaining();

		if(time_left < 0) {
			document.getElementById("text_stage_clock").innerHTML = "TIME OUT!";
		} else {
			document.getElementById("text_stage_clock").innerHTML = Clock.format_time(time_left);
			manager.read_move();
			manager.check_moves();
		}
	}
}

update()
var update_repeater = setInterval(update, 50);

// Space button
document.body.onkeyup = function(e){
    if(e.keyCode == 32){
        manager.user_action()
    } else if(e.keyCode == 27) {
    	manager.reset()
    } else {
    	manager.mute = true
    }
}