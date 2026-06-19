"""
로고를 한 번에 받아 backend/logo_cache/ 에 실제 이미지 파일로 저장합니다.
사용:  python prefetch_logos.py          (없는 것만 받기)
       python prefetch_logos.py --force  (전부 다시 받기)
"""
import sys
import logos

if __name__ == "__main__":
    force = "--force" in sys.argv
    print(f"로고 다운로드 시작 (force={force}) …")
    ok, ph = logos.prefetch_all(force=force, verbose=True)
    print(f"\n완료: 실제 로고 {ok}개 / 폴백(이니셜) {ph}개")
    print(f"저장 위치: {logos.CACHE}")
