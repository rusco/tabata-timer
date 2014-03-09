package main

import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/rusco/jquery"
	"math"
	"strconv"
)

var (
	jQuery = jquery.NewJQuery
)

const (
	ORANGE = "#FFA100"
	BLUE   = "#0F4DA8"
	ON     = ORANGE
	OFF    = BLUE
)

func main() {

	timer := NewTabataTimer()

	jQuery("button").On("click", func(e jquery.Event) {
		timer.start()
		e.PreventDefault()
	})
}

type TabataTimer struct {
	element       jquery.JQuery
	onSec         jquery.JQuery
	offSec        jquery.JQuery
	endDate       float64
	interval      int
	rounds        int
	roundFinished bool
}

func NewTabataTimer() *TabataTimer {

	element := jQuery("time")
	onSec := jQuery("#on")
	offSec := jQuery("#off")

	endDate := 0.0
	interval := 0
	rounds := 1
	roundFinished := false

	return &TabataTimer{element, onSec, offSec, endDate, interval, rounds, roundFinished}
}

func (t *TabataTimer) start() {

	var err error
	t.rounds, err = strconv.Atoi(jQuery("#rounds").Val())
	if err != nil {
		return
	}
	t.restart()

	t.interval = js.Global.Call("setInterval", t.tick, 100).Int()

}

func (t *TabataTimer) tick() {

	timeDelta := t.endDate - jquery.Now() + 1000.0

	if timeDelta > 0 {
		formattedTime := t.convertToTime(timeDelta)
		t.element.SetHtml(formattedTime.minutes + ":" + formattedTime.seconds)
	} else {
		if t.rounds > 0 {
			if t.roundFinished {
				jQuery("#rounds").SetVal(t.rounds)
				t.restart()
			} else {
				t.breakTimer()
				t.rounds -= 1
			}
		} else {
			t.playSound()
			js.Global.Call("clearTimeout", t.interval)

		}
	}

}

func (t *TabataTimer) pad(n int) string {
	if n > 9 {
		return strconv.Itoa(n)
	}
	return "0" + strconv.Itoa(n)

}

type time struct {
	minutes string
	seconds string
}

func (t *TabataTimer) convertToTime(milliseconds float64) time {

	tmsec := math.Floor(milliseconds / 1000)
	minutes := math.Floor(tmsec / 60)
	seconds := tmsec - (minutes * 60)

	return time{t.pad(int(minutes)), t.pad(int(seconds))}

}

func (t *TabataTimer) breakTimer() {
	offsec, err := strconv.Atoi(t.offSec.Val())
	if err != nil {
		return
	}
	t.endDate = jquery.Now() + float64(offsec)*1000
	t.roundFinished = true
	t.element.SetCss("color", ON)

}

func (t *TabataTimer) restart() {
	onSec, err := strconv.Atoi(t.onSec.Val())
	if err != nil {
		return
	}
	t.endDate = jquery.Now() + float64(onSec)*1000

	t.roundFinished = false
	t.element.SetCss("color", OFF)

}

func (t *TabataTimer) playSound() {
	js.Global.Call("alert", "End!")

}
