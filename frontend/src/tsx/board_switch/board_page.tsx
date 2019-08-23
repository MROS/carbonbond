import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import { EditorPanelState, UserState, MainScrollState } from '../global_state';

import '../../css/board_page.css';
import { ajaxOperation } from '../../ts/api';
import { ArticleMeta } from '.';

const PAGE_SIZE: number = 10;

type Props = RouteComponentProps<{ board_name: string }>;

// TODO: Show fetching animation before data

async function fetchArticles(
	board_name: string,
	page_size: number,
	offset: number
): Promise<ArticleMeta[]> {
	let res = await ajaxOperation.ArticleList({ board_name, page_size, offset });
	return res.articleList;
}

export function BoardPage(props: Props): JSX.Element {
	let { user_state } = UserState.useContainer();
	const { editor_panel_data, openEditorPanel } = EditorPanelState.useContainer();
	let board_name = props.match.params.board_name;

	function onEditClick(): void {
		if (editor_panel_data) {
			alert('正在編輯其它文章');
		} else {
			openEditorPanel({ board_name });
		}
	}

	const [articles, setArticles] = React.useState<ArticleMeta[]>([]);

	React.useEffect(() => {
		fetchArticles(board_name, PAGE_SIZE, 0).then(more_articles => {
			console.log(more_articles);
			setArticles(more_articles);
		});
	}, [board_name]);

	const scrollHandler = React.useCallback((): void => {
		// 第一次載入結束前不要動作
		if (articles.length > 0) {
			console.log('Touch End');
			const length = articles.length;
			fetchArticles(board_name, PAGE_SIZE, length).then(more_articles => {
				// TODO: 載入到最早的文章就停
				if (more_articles.length > 0) {
					console.log(more_articles);
					setArticles([...articles, ...more_articles]);
				}
			});
		}
	}, [articles, board_name]);
	let { useScrollToBottom } = MainScrollState.useContainer();
	useScrollToBottom(scrollHandler);

	return <div styleName="boardContent">
		<h1>{board_name}</h1>
		{
			(() => {
				if (user_state.login) {
					return <h5 onClick={() => onEditClick()}>發表文章</h5>;
				}
			})()
		}

		<ul>
			{
				articles.map((article, idx) => (
					<Link to={`/app/b/${board_name}/a/${article.id}`} key={idx}>
						<li styleName="articleTitle">
							<p>{article.id} - {article.title}</p>
						</li>
					</Link>
				))
			}
		</ul>
	</div>;
}