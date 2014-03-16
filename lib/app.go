package main

import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/gopherjs/jquery"
	"math"
	"strconv"
)

var (
	jQuery = jquery.NewJQuery
)

const (
	ORANGE     = "#f57b00"
	BLUE       = "#1f8dd6"
	ON         = ORANGE
	OFF        = BLUE
	ESCAPE_KEY = 27
	SPACE_KEY  = 32
	CR_KEY     = 13
)

type time struct {
	minutes string
	seconds string
}

type TabataTimer struct {
	time          jquery.JQuery
	onSec         jquery.JQuery
	offSec        jquery.JQuery
	roundno       jquery.JQuery
	splash        jquery.JQuery
	endDate       float64
	interval      int
	rounds        int
	roundFinished bool
}

func main() {

	timer := NewTabataTimer()

	jQuery("body").On(jquery.KEYDOWN, func(e jquery.Event) {
		switch e.KeyCode {
		case ESCAPE_KEY:
			timer.init()
		case SPACE_KEY, CR_KEY:
			timer.start()
		}
	})

	jQuery("#button").On(jquery.CLICK, func(e jquery.Event) {
		timer.start()
		e.PreventDefault()
	})
}

func NewTabataTimer() *TabataTimer {

	time := jQuery("time")
	onSec := jQuery("#on")
	offSec := jQuery("#off")
	roundNo := jQuery("#roundno")
	splash := jQuery(".splash-container")

	endDate := 0.0
	interval := 0
	rounds := 0
	roundFinished := false

	return &TabataTimer{time, onSec, offSec, roundNo, splash, endDate, interval, rounds, roundFinished}
}

func (t *TabataTimer) start() {

	if t.interval != 0 {
		//is running already, don't start again:
		return
	}

	var err error
	t.rounds, err = strconv.Atoi(jQuery("#rounds").Val())
	if err != nil {
		return
	}
	t.roundno.SetText(t.pad(t.rounds))
	t.restart()
	t.interval = js.Global.Call("setInterval", t.tick, 100).Int()
}

func (t *TabataTimer) tick() {

	timeDelta := t.endDate - jquery.Now() + 1000.0
	if !t.roundFinished {
		t.roundno.SetText(t.pad(t.rounds))
	}

	if timeDelta > 0 {
		formattedTime := t.convertToTime(timeDelta)
		t.time.SetHtml(formattedTime.minutes + ":" + formattedTime.seconds)
	} else {
		if t.rounds > 0 {
			if t.roundFinished {
				t.restart()
			} else {
				t.breakTimer()
				t.rounds -= 1
			}
		} else { //finish
			t.roundno.SetText(t.pad(t.rounds))
			t.interval = js.Global.Call("clearTimeout", t.interval).Int()
		}
	}
}

func (t *TabataTimer) pad(n int) string {
	if n > 9 {
		return strconv.Itoa(n)
	}
	return "0" + strconv.Itoa(n)
}

func (t *TabataTimer) convertToTime(milliseconds float64) time {

	tmsec := math.Floor(milliseconds / 1000)
	minutes := math.Floor(tmsec / 60)
	seconds := tmsec - (minutes * 60)

	return time{t.pad(int(minutes)), t.pad(int(seconds))}
}

func (t *TabataTimer) breakTimer() {
	offSeconds, err := strconv.Atoi(t.offSec.Val())
	if err != nil {
		return
	}
	t.endDate = jquery.Now() + float64(offSeconds)*1000
	t.roundFinished = true

	t.splash.SetCss("background-color", OFF)
}

func (t *TabataTimer) restart() {
	onSeconds, err := strconv.Atoi(t.onSec.Val())
	if err != nil {
		return
	}
	t.endDate = jquery.Now() + float64(onSeconds)*1000
	t.roundFinished = false

	t.splash.SetCss("background-color", ON)
}

func (t *TabataTimer) init() {

	t.interval = js.Global.Call("clearTimeout", t.interval).Int()

	t.roundno.SetText("00")
	t.time.SetHtml("00:00")
	t.splash.SetCss("background-color", OFF)
}
