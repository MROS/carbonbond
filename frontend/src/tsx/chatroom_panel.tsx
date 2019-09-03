import * as React from 'react';
import '../css/bottom_panel.css';
import { relativeDate } from '../ts/date';
import { differenceInMinutes } from 'date-fns';
import { useScrollBottom, useInputValue } from './utils';
import { Message } from './global_state';
import useOnClickOutside from 'use-onclickoutside';
import {
	BottomPanelState,
	AllChatState,
	IMessage,
	RoomData,
	SimpleRoomData,
	ChannelRoomData,
	isChannelRoomData
} from './global_state';
import { isEmojis, isLink, isImageLink } from '../ts/regex_util';
import 'emoji-mart/css/emoji-mart.css?global';
import * as EmojiMart from 'emoji-mart';

const Picker = React.lazy(() => {
	return import(/* webpackChunkName: "emoji-mart" */ 'emoji-mart')
		.then(({ Picker }) => ({ default: Picker }));
});

type AggDialog = {
	who: string,
	date: Date,
	contents: string[]
};

function aggregateDiaglogs(dialogs: IMessage[]): AggDialog[] {
	if (dialogs.length == 0) {
		return [];
	}
	let tmp = {
		who: dialogs[0].sender_name,
		date: dialogs[0].time,
		contents: [dialogs[0].content]
	};
	if (dialogs.length == 1) {
		return [tmp];
	}
	const ret: AggDialog[] = [];
	let cur_date = tmp.date;
	for (let i = 1; i < dialogs.length; i++) {
		// 如果作者相同、上下兩則訊息相距不到一分鐘，則在 UI 上合併
		const dialog = dialogs[i];
		if (tmp.who == dialog.sender_name && differenceInMinutes(dialog.time, cur_date) < 1) {
			tmp.contents.push(dialog.content);
		} else {
			ret.push(tmp);
			tmp = {
				who: dialog.sender_name,
				date: dialog.time,
				contents: [dialog.content]
			};
		}
		cur_date = dialog.time;
	}
	ret.push(tmp);
	return ret;
}

function DialogShow(props: { content: string }): JSX.Element {
	if (isEmojis(props.content)) {
		return <div styleName="emojis">{props.content}</div>;
	} else if (isImageLink(props.content)) {
		// 注意：如果是 ImageLink ，那必定是 Link ，所以本分支要先判斷
		return <div>
			<div styleName="normal"><a href={props.content} target="_blank">{props.content}</a></div>
			<div styleName="image"><img src={props.content} /></div>
		</div>;
	} else if (isLink(props.content)) {
		return <div styleName="normal">
			<a href={props.content} target="_blank">{props.content}</a>
		</div>;
	} else {
		return <div styleName="normal">{props.content}</div>;
	}
}

const DialogBlocks = React.memo((props: {dialogs: IMessage[]}): JSX.Element => {
	const agg_dialogs = aggregateDiaglogs(props.dialogs);
	return <>
	{
		// XXX: key 要改成能表示時間順序的 id
		agg_dialogs.map(dialog => <div key={Number(dialog.date)} styleName="dialogBlock">
			<div styleName="meta">
				<span styleName="who">{dialog.who}</span>
				<span styleName="date">{relativeDate(dialog.date)}</span>
			</div>
			{
				dialog.contents.map((content, index) => {
					return <DialogShow content={content} key={index} />;
				})
			}
		</div>)
	}
	</>
	;
});

type InputEvent = React.ChangeEvent<HTMLInputElement>;

type InputBarProp = {
	input_props: {
		onChange: (e: InputEvent) => void,
		value: string
	},
	setValue: React.Dispatch<React.SetStateAction<string>>,
	onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void,
};

type Emoji = {
	native: string
};

function InputBar(props: InputBarProp): JSX.Element {
	const inputElement = React.useRef<HTMLInputElement>(null);
	const [extendEmoji, setExtendEmoji] = React.useState(false);
	const ref = React.useRef(null);
	useOnClickOutside(ref, () => setExtendEmoji(false));

	function onSelect(emoji: EmojiMart.EmojiData): void {
		if (inputElement && inputElement.current) {  // 判斷式只是爲了 TS 的型別檢查
			inputElement.current.focus();
			const value = props.input_props.value;
			const start = inputElement.current.selectionStart;
			const end = inputElement.current.selectionEnd;
			if (start == null || end == null) {
				const new_value = value + (emoji as Emoji).native;
				props.setValue(new_value);
			} else {
				const left = value.slice(0, start);
				const right = value.slice(end);
				let em = (emoji as Emoji).native;
				const new_value = left + em + right;
				window.requestAnimationFrame(() => {
					inputElement.current!.selectionStart = start + em.length;
					inputElement.current!.selectionEnd = start + em.length;
				});
				props.setValue(new_value);
			}
		}
	}

	function onKeyDownWrap(e: React.KeyboardEvent<HTMLInputElement>): void {
		props.onKeyDown(e);
		setExtendEmoji(false);
	}

	function onClick(): void {
		if (inputElement && inputElement.current) {  // 判斷式只是爲了 TS 的型別檢查
			inputElement.current.focus();
		}
		setExtendEmoji(!extendEmoji);
	}

	return <div styleName="inputBar">
		<div styleName="nonText" ref={ref}>
			<div onClick={onClick}>😎</div>
			{
				extendEmoji ?
					<React.Suspense fallback={<div styleName="loading">載入中...</div>}>
						<div styleName="emojiPicker">
							<Picker
								native={true}
								showPreview={false}
								showSkinTones={false}
								onSelect={onSelect} />
						</div>
					</React.Suspense> :
					<></>
			}
		</div>
		<input {...props.input_props}
			ref={inputElement}
			onKeyDown={onKeyDownWrap}
			type="text"
			placeholder="輸入訊息..."
			autoFocus
		/>
	</div>;
}

// 聊天室
function SimpleChatRoomPanel(props: {room: SimpleRoomData}): JSX.Element {
	const { deleteRoom } = BottomPanelState.useContainer();
	const { all_chat, addDialog, updateLastRead } = AllChatState.useContainer();
	const [extended, setExtended] = React.useState(true);
	const { input_props, setValue } = useInputValue('');
	const scroll_bottom_ref = useScrollBottom();
	const chat = all_chat.direct.find(c => c.name == props.room.name);
	if (chat == undefined) { console.error(`找不到聊天室 ${props.room.name}`); }
	React.useEffect(() => {
		if (extended && chat!.isUnread()) {
			updateLastRead(props.room.name, new Date());
		}
	}, [extended, chat, updateLastRead, props.room.name]);

	if (extended) {

		function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
			if (e.key == 'Enter' && input_props.value.length > 0) {
				const now = new Date();
				addDialog(props.room.name, new Message({
					sender_name: '金剛', // TODO: 換成 me
					content: input_props.value,
					time: now,
				}));
				setValue('');
			}
		}

		return <div styleName="chatPanel singlePanel">
			<div styleName="roomTitle title">
				<div styleName="leftSet">{props.room.name}</div>
				<div styleName="middleSet" onClick={() => setExtended(false)}></div>
				<div styleName="rightSet">
					<div styleName="button">⚙</div>
					<div styleName="button" onClick={() => deleteRoom(props.room.name)}>✗</div>
				</div>
			</div>
			<div ref={scroll_bottom_ref} styleName="dialogs">
				<DialogBlocks dialogs={chat!.history.toJS()}/>
			</div>
			<InputBar input_props={input_props} setValue={setValue} onKeyDown={onKeyDown}/>
		</div>;
	} else {
		return <div styleName="chatPanel singlePanel roomWidth">
			<div styleName="roomTitle title">
				<div styleName="leftSet">{props.room.name}</div>
				<div styleName="middleSet" onClick={() => setExtended(true)}></div>
				<div styleName="rightSet">
					<div styleName="button" onClick={() => deleteRoom(props.room.name)}>✗</div>
				</div>
			</div>
		</div>;
	}
}

function ChannelChatRoomPanel(props: {room: ChannelRoomData}): JSX.Element {
	const { deleteRoom, changeChannel } = BottomPanelState.useContainer();
	const { all_chat, addChannelDialog, updateLastReadChannel } = AllChatState.useContainer();
	const [extended, setExtended] = React.useState(true);
	const { input_props, setValue } = useInputValue('');
	const scroll_bottom_ref = useScrollBottom();

	const chat = all_chat.group.find(c => c.name == props.room.name);
	if (chat == undefined) { console.error(`找不到聊天室 ${props.room.name}`); }
	const channel = chat!.channels.find(c => c.name == props.room.channel);
	if (channel == undefined) { console.error(`找不到頻道 ${props.room.channel}`); }

	React.useEffect(() => {
		if (extended && channel!.isUnread()) {
			updateLastReadChannel(props.room.name, props.room.channel, new Date());
		}
	}, [extended, channel, updateLastReadChannel, props.room.name, props.room.channel]);

	if (extended) {

		function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
			if (e.key == 'Enter' && input_props.value.length > 0) {
				const now = new Date();
				console.log(props.room.channel);
				addChannelDialog(props.room.name, props.room.channel, new Message({
					sender_name: '金剛', // TODO: 換成 me
					content: input_props.value,
					time: now,
				}));
				setValue('');
			}
		}

		function ChannelList(): JSX.Element {
			return <div styleName="channelList">
				{
					chat!.channels.valueSeq().map(c => {
						const is_current = c.name == channel!.name;
						const channel_style = `channel${is_current ? ' selected' : ''}`;
						return <div styleName={channel_style} key={c.name} onClick={() => { changeChannel(chat!.name, c.name); }}>
							<span styleName="channelSymbol"># </span>
							{c.name}
						</div>;
					}).toJS()
				}
			</div>;
		}

		return <div styleName="chatPanel singlePanel">
			<div styleName="roomTitle title">
				<div styleName="leftSet">{props.room.name}</div>
				<div styleName="middleSet" onClick={() => setExtended(false)}>#{props.room.channel}</div>
				<div styleName="rightSet">
					<div styleName="button">⚙</div>
					<div styleName="button" onClick={() => deleteRoom(props.room.name)}>✗</div>
				</div>
			</div>
			<div styleName="panelContent">
				<div styleName="channels">
					<div styleName="channelControl">
						<div styleName="leftSet">頻道列表</div>
						<div styleName="rightSet">➕</div>
					</div>
					<ChannelList />
				</div>
				<div>
					<div ref={scroll_bottom_ref} styleName="dialogs">
						<DialogBlocks dialogs={channel!.history.toJS()} />
					</div>
					<InputBar input_props={input_props} setValue={setValue} onKeyDown={onKeyDown}/>
				</div>
			</div>
		</div>;
	} else {
		return <div styleName="chatPanel singlePanel roomWidth">
			<div styleName="roomTitle title">
				<div styleName="leftSet">{props.room.name}</div>
				<div styleName="middleSet" onClick={() => setExtended(true)}>#{props.room.channel}</div>
				<div styleName="rightSet">
					<div styleName="button" onClick={() => deleteRoom(props.room.name)}>✗</div>
				</div>
			</div>
		</div>;
	}
}

function ChatRoomPanel(props: {room: RoomData}): JSX.Element {
	if (isChannelRoomData(props.room)) {
		return <ChannelChatRoomPanel room={props.room} />;
	} else  {
		return <SimpleChatRoomPanel room={props.room} />;
	}
}

export {
	ChatRoomPanel
};