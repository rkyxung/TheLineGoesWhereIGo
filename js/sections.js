// 섹션 데이터 로드
let sections = [];

async function loadSections() {
    try {
        const response = await fetch('data/sections.json');
        sections = await response.json();
        // 섹션 로드 완료 이벤트 발생
        window.dispatchEvent(new CustomEvent('sectionsLoaded'));
    } catch (error) {
        console.error('섹션 데이터 로드 실패:', error);
        // 에러 발생 시 빈 배열로 설정
        sections = [];
        alert('섹션 데이터를 불러올 수 없습니다. data/sections.json 파일을 확인해주세요.');
    }
}

// 페이지 로드 시 섹션 데이터 로드
loadSections();


