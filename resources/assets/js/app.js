require('./bootstrap');
require('./lockFunctions');

// Dependencies
window.Vue = require('vue')
import FullCalendar from 'vue-full-calendar'
import 'fullcalendar-scheduler'
import ToggleButton from 'vue-js-toggle-button'
const moment = require('moment');
import 'jquery-ui-bundle';
import 'jquery-ui-bundle/jquery-ui.css';

// Stylesheets
import 'fullcalendar/dist/fullcalendar.min.css'
import 'fullcalendar-scheduler/dist/scheduler.min.css'
import 'toastr/build/toastr.min.css';

// Vue.component('example-component', require('./components/ExampleComponent.vue'))
Vue.component('modal', require('./components/Modal.vue'))
Vue.component('apptmodal', require('./components/ApptModal.vue'))
Vue.component('viewmodal', require('./components/ViewModal.vue'))
Vue.component('waitlist', require('./components/WaitList.vue'))
Vue.component('waitlistcard', require('./components/WaitListCard.vue'))
Vue.use(FullCalendar)
Vue.use(ToggleButton)

const app = new Vue({
	el: '#app',

	data() {
		var self = this;
		return {
			showModal: false,
			showApptModal: false,
			showViewModal: false,
			selectedId: 0,
			selectedTitle: '',
			selectedDescription: '',
			selectedResourceId: '',
			selectedStart: '',
			selectedEnd: '',
			lockStart: '',
			lockEnd: '',
			allResourceInfo: {},
			waitList: {},
			eventSources: [
			{
				events(start, end, timezone, callback) {
					window.axios.post('/appointments', {
						startDate: start,
						endDate: end
					})
					.then((response) => {
						callback(response.data)
					})
				}
			}],
			config: {
				schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
				resourceLabelText: "Rooms",
				resources: function(callback, start, end, timezone) {
					window.axios.get('/resources')
						.then((response) => {
							self.allResourceInfo = response.data
							callback(response.data)
						}
					)
				},
				customButtons: {
					promptResource: {
						text: 'Add Room',
						click: function(event) {
							self.toggleModal();
						}
					},
					addAppt: {
						text: 'Add Appt',
						click: function(event) {
							self.toggleApptModal();
						}
					}
				},
				defaultView: "timelineDay",
				editable: true,
				droppable: true,
				selectable: true,
				selectHelper: true,
				header: {
					left: "promptResource addAppt today prev,next",
					center: "title",
					right: "agendaDay,timelineDay,agendaWeek,month"
				},
				select: function (start, end, jsEvent, view, resource) {

					self.lockStart = start.format('X')
					self.lockEnd = end.format('X');

					window.lockFxns.lockTimeSlot(resource.id, start, end);

					self.selectedStart = start.format().replace('Z','')
					self.selectedEnd = end.format().replace('Z','')
					self.selectedResourceId = resource.id
					self.toggleApptModal();

				},
				eventClick: function(calEvent, jsEvent, view) {
					window.lockFxns.lock('appt', calEvent.id)
					window.axios.get('/appointments/' + calEvent.id)
						.then((response) => {
							self.selectedId = response.data.id
							self.selectedTitle = response.data.title
							self.selectedStart = response.data.start
							self.selectedEnd = response.data.end
							self.selectedResourceId = response.data.resource_id
							self.selectedDescription = response.data.description
						})
						.then((data) => {
							self.showViewModal = true
						})

				},
				eventDrop: function( event, delta, revertFunc, jsEvent, ui, view ) {

					window.axios.put('/appointments/' + event.id,
						{
							title: event.title,
							description: event.description,
							resource_id: event.resourceId,
							start: event.start.format(),
							end: event.end.format()
						})
					.then((response) => {
						toastr.info('Appointment updated');
					})

				},
				drop: function(date, jsEvent, ui, resourceId) {

					// Lock on waitlist
					let cardId = this.dataset.id

					window.axios.put('/appointments/' + this.dataset.id,
						{
							title: this.dataset.title,
							description: (this.dataset.description == null ? '' : this.dataset.description),
							resource_id: resourceId,
							start: date.format(),
							end: date.add(2, 'hours').format()
						})
					.then((response) => {
						toastr.info('Appointment scheduled. Resize to adjust time.');
					})

				},
				eventResize: function( event, jsEvent, ui, view ) {

					window.axios.put('/appointments/' + event.id,
						{
							title: event.title,
							description: (event.description == null ? '' : event.description),
							resource_id: event.resourceId,
							start: event.start.format(),
							end: event.end.format()
						})
					.then((response) => {
						toastr.info('Appointment updated');
					})
				},
				eventRender: function(event, element, view) {

					if (event.rendering == 'background') {

						element.append(event.title);

					}

					element.find('.fc-title').append("<br/><small>" + event.description + "</small>");

				},
			}
		}
	},
	methods: {
		toggleModal() {

			this.showModal = !this.showModal

		},
		toggleApptModal() {

			this.showApptModal = !this.showApptModal

		},
		getWaitList() {

			window.axios.get('/waitlist')
				.then((response) => {
					this.waitList = response.data
				});

		},
		refreshEvents() {

			$('#calendar').fullCalendar('refetchResources');
			$('#calendar').fullCalendar('refetchEvents');
			this.getWaitList()

		},

		removeEvent() {

			this.$refs.calendar.$emit('remove-event', this.selected)
			this.selected = {};

		},

		eventSelected(event) {

			this.selected = event

		},

		eventCreated(...test) {

			console.log(test)

		},

	},

	computed: {
		theWaitlist() {

		}
	},

	created() {

		this.getWaitList()

	},

	mounted() {
		console.log('App mounted')
		window.Echo.channel('dev-to-contest')
			.listen('.waitlist', (e) => {
				toastr.info('Waitlist has been updated')
				this.getWaitList();
			});

		window.Echo.channel('dev-to-contest')
			.listen('.calendar', (e) => {
				toastr.info('Calendar has been updated')
				this.refreshEvents();

			});
	}

});