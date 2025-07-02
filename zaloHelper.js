/**
 * Lấy danh sách group rút gọn (chỉ lấy vài key)
 * @param {any} api - instance Zalo đã đăng nhập
 * @returns {Promise<Array<{ groupId: string, name: string, avt: string, totalMember: number }>>}
 */
export async function getShortGroupList(api) {
    try {
      const allGroups = await api.getAllGroups();
      const gridVerMap = allGroups.gridVerMap;
  
      if (!gridVerMap || typeof gridVerMap !== 'object') {
        throw new Error('Không tìm thấy gridVerMap');
      }
  
      const groupIds = Object.keys(gridVerMap);
      const res = await api.getGroupInfo(groupIds);
  
      const groupList = Object.values(res.gridInfoMap || {});
  
      // ⚠️ Lọc key ra đây
      return groupList.map(group => ({
        groupId: group.groupId,
        name: group.name,
        avt: group.avt,
        totalMember: group.totalMember,
      }));
    } catch (err) {
      console.error('❌ Lỗi khi lấy danh sách nhóm:', err);
      return [];
    }
  }
  