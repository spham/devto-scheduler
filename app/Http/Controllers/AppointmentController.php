<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Resource;
use App\Appointment;
use App\User;
use Illuminate\Support\Facades\Redis;
use Auth;
use Cake\Chronos\Chronos;
use Carbon\Carbon;
use App\Helpers\LockHelper;
use App\Events\UpdateWaitlistEvent;
use App\Events\NewAppointmentEvent;

class AppointmentController extends Controller
{

	protected $redisConnection;

	public function __construct()
	{

		$this->middleware('auth');

		// Redis connection to get locks
		$this->redisConnection = Redis::connection();

	}

	public function add(Request $request)
	{

		$resource = Appointment::create([
			'title' => $request->title,
			'description' => $request->description,
			'start' => !is_null($request->start) ? new Carbon($request->start) : null,
			'end' => !is_null($request->end) ? new Carbon($request->end) : null,
			'resource_id' => $request->resource_id
		]);

		if(is_null($request->start) || $is_null($request->end)) {

			event(new UpdateWaitlistEvent($resource->toArray()));

		} else {
			event(new NewAppointmentEvent($resource->toArray()));
		}

		return response()->json($resource);

	}

	public function view($id)
	{

		$appt = Appointment::where('id', $id)->first();

		// Let's create an appointment lock if it has a time, or a waitlist lock if not
		LockHelper::lock('appt', $id);

		return response()->json($appt);

	}

	public function update($id, Request $request)
	{

		$appt = Appointment::updateOrCreate(
			[
				'id' => $id
			],
			[
				'title' => $request->title,
				'description' => $request->description,
				'start' => !is_null($request->start) ? new Carbon($request->start) : null,
				'end' => !is_null($request->end) ? new Carbon($request->end) : null,
				'resource_id' => $request->resource_id
			]

		);

		event(new NewAppointmentEvent($appt->toArray()));

		return response()->json($appt);

	}

	public function index(Request $request)
	{

		$outputData = [];

		$resources = Appointment::whereBetween('start', [$request->startDate, $request->endDate])
								->get();

		$resources->each(function ($r) use (&$outputData) {

			$outputData[] = array(
				'id' => $r->id,
				'resourceId' => $r->resource_id,
				'title' => $r->title,
				'description' => $r->description,
				'start' => $r->start,
				'end' => $r->end,
				'className' => (LockHelper::has('appt', $r->id) ? 'locked' : '')
			);

		});

		// Get Slot Locks
		$locks = LockHelper::get('slot');

		foreach ($locks as $l) {
			$lock = $this->redisConnection->get($l);
			
			$lockData = explode(':', $l);

			$timeData = explode('-', $lockData[4]);

			$theUser = User::where('id', $lock)->first();

			$start = Carbon::createFromFormat('U', $timeData[0]);

			$end = Carbon::createFromFormat('U', $timeData[1]);

			$outputData[] = array(
				'resourceId' => $lockData[2],
				'title' => "Locked by:<br />" . $theUser->name,
				'start' => $start->toDateTimeString(),
				'end' => $end->toDateTimeString(),
				'rendering' => 'background',
				'editable' => false
			);

		}

		return response()->json($outputData);

	}

}